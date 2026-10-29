'use client';
/* Sync between devices through Firebase (Google's online database). Same method as the original Dayline.
   Each task, event and note is one record under users/{your account}/items.
   Locked notes travel as the same encrypted bundle that is stored on the phone (users/{you}/meta/vault),
   so they can only be read with your PIN.
   How changes are found: after every save each item is compared with a fingerprint of what was last
   synced. Changed items are uploaded; items that disappeared are uploaded as "deleted".
   Changes from other devices arrive through a live listener and replace the local copy.
   Attached files are cut into pieces of about 0.5 MB (users/{you}/files/{id}/chunks/0,1,2…) because one
   database record can hold at most 1 MB. This keeps everything on Firebase's free plan. */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { app, emit, idbDel, idbGet, idbSet, onSave } from './store';
import { blobToB64, onRemoteFetch } from './files';
import { unb64, reopenWithKey } from './vault';
import { FIREBASE, COLLECTION_PREFIX as P } from './config';
import type { FileRecord, State } from '@/types';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
let retry: any = null, auth: any = null, db: any = null, user: any = null, ready = false, vaultSeen = false,
  started = false, unsub: (() => void)[] = [], timer: any = null, lastOk: number | null = null, error = '';

// Same content always gives the same text, whatever order the fields come back in.
const stable = (v: any): string => Array.isArray(v) ? '[' + v.map(stable).join(',') + ']'
  : v && typeof v === 'object' ? '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}'
  : JSON.stringify(v);
function hash(str: string) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
const fp = (v: any) => hash(stable(v));
const clean = (v: any) => JSON.parse(JSON.stringify(v));
const LISTS: Record<string, 'tasks' | 'events' | 'notes'> = { task: 'tasks', event: 'events', note: 'notes' };
const S = () => app.S as State & Record<string, any>;

function loadScript(src: string) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.append(s); });
}
async function boot() {
  const w = window as any;
  if (w.__daylineFirebase) { ({ auth, db } = w.__daylineFirebase); return; } // test hook
  for (const f of ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js']) await loadScript(SDK + f);
  const fb = w.firebase;
  if (!fb.apps.length) fb.initializeApp(FIREBASE);
  db = fb.firestore();
  try { await db.enablePersistence({ synchronizeTabs: true }); } catch { /* another tab already did */ }
  auth = fb.auth();
}
const userDoc = () => db.collection('users').doc(user.uid);
const items = () => userDoc().collection(P + 'items');
const filesCol = () => userDoc().collection(P + 'files');
const vaultDoc = () => userDoc().collection(P + 'meta').doc('vault');
const st = () => S().sync!;

function collect() {
  const m = new Map<string, [string, any]>();
  S().tasks.forEach((x) => m.set(x.id, ['task', x]));
  S().events.forEach((x) => m.set(x.id, ['event', x]));
  S().notes.forEach((x) => m.set(x.id, ['note', x]));
  return m;
}
function wantedFiles() {
  const w = new Set<string>();
  [...S().notes, ...S().tasks, ...S().events].forEach((n) => (n.files || []).forEach((f) => w.add(f.id)));
  return w;
}

async function push() {
  timer = null;
  if (!user || !ready || !S().sync) return;
  const last = st().last, ops: any[] = [];
  for (const [id, [kind, x]] of collect()) {
    if (last[id] === fp(x)) continue;
    x.updated = Date.now(); last[id] = fp(x);
    ops.push([items().doc(id), { kind, data: clean(x), updated: x.updated, deleted: false }]);
  }
  const now = collect();
  for (const id of Object.keys(last)) {
    if (id === '__vault' || id.startsWith('f:') || now.has(id)) continue;
    delete last[id]; ops.push([items().doc(id), { deleted: true, updated: Date.now() }]);
  }
  const vf = fp(S().vault || null);
  // Only after the online copy of the locked notes has been read, so a device without them never wipes them.
  if (vaultSeen && last.__vault !== vf && !(S().vault == null && last.__vault === undefined)) {
    last.__vault = vf; ops.push([vaultDoc(), { vault: S().vault ? clean(S().vault) : null, updated: Date.now() }]);
  }
  // Files: upload new ones, remove ones nothing uses any more.
  const want = wantedFiles();
  for (const id of want) {
    if (last['f:' + id]) continue;
    const rec = await idbGet<FileRecord>('file:' + id); if (!rec) continue;
    last['f:' + id] = 1; ops.push(null);
    uploadFile(id, rec).then(() => { lastOk = Date.now(); paint(); })
      .catch((e) => { delete last['f:' + id]; error = 'Could not upload ' + rec.name + ': ' + (e.message || e); paint(); });
  }
  for (const k of Object.keys(last)) if (k.startsWith('f:') && !want.has(k.slice(2))) {
    const id = k.slice(2); delete last[k]; ops.push(null); idbDel('file:' + id); deleteRemoteFile(id).catch(() => {});
  }
  if (!ops.length) return;
  await idbSet('state', S());
  for (let i = 0; i < ops.length; i += 400) {
    const part = ops.slice(i, i + 400).filter(Boolean); if (!part.length) continue;
    const b = db.batch(); part.forEach(([ref, data]: any) => b.set(ref, data));
    b.commit().then(() => { lastOk = Date.now(); error = ''; paint(); })
      .catch((e: any) => { error = e.code === 'permission-denied' ? 'The online database refused the change. Check the security rules from the setup guide.' : 'Could not upload: ' + (e.message || e); paint(); });
  }
}

const CH = 700000; // characters per piece; a multiple of 4 so each piece is whole base64
async function uploadFile(id: string, rec: FileRecord) {
  const data = await blobToB64(rec.blob), n = Math.max(1, Math.ceil(data.length / CH)), ref = filesCol().doc(id);
  for (let i = 0; i < n; i += 8) {
    const b = db.batch();
    for (let j = i; j < Math.min(n, i + 8); j++) b.set(ref.collection('chunks').doc(String(j)), { d: data.slice(j * CH, (j + 1) * CH) });
    await b.commit();
  }
  await ref.set({ name: rec.name, type: rec.type || '', size: rec.size, chunks: n, updated: Date.now() }); // written last, so a half-uploaded file is never read
}
async function deleteRemoteFile(id: string) {
  const ref = filesCol().doc(id), cs = await ref.collection('chunks').get(), b = db.batch();
  cs.docs.forEach((d: any) => b.delete(d.ref)); b.delete(ref); await b.commit();
}
async function fetchFile(id: string): Promise<FileRecord | null> {
  if (!user || !ready) return null;
  const ref = filesCol().doc(id), m = await ref.get(); if (!m.exists) return null;
  const md = m.data(); let data = '';
  for (let i = 0; i < md.chunks; i++) { const c = await ref.collection('chunks').doc(String(i)).get(); if (!c.exists) return null; data += c.data().d; }
  const rec = { name: md.name, type: md.type, size: md.size, blob: new Blob([unb64(data) as BlobPart], { type: md.type }) };
  await idbSet('file:' + id, rec); return rec;
}
// Download files that arrived from other devices, so they also open without internet later.
let fetching = false;
async function prefetch() {
  if (fetching || !user || !ready) return; fetching = true;
  try { for (const id of wantedFiles()) { if (!user) break; if (!(await idbGet('file:' + id))) await fetchFile(id).catch(() => {}); } }
  finally { fetching = false; }
}
function schedule() { if (user && ready && !timer) timer = setTimeout(push, 800); }

function removeLocal(id: string) {
  let hit = false;
  for (const k of ['tasks', 'events', 'notes'] as const) {
    const n = S()[k].length; (S() as any)[k] = (S()[k] as any[]).filter((x) => x.id !== id); if (S()[k].length !== n) hit = true;
  }
  return hit;
}
function upsertLocal(kind: string, data: any) { removeLocal(data.id); (S()[LISTS[kind]] as any[]).push(data); }

function onItems(snap: any) {
  let changed = false;
  snap.docChanges().forEach((ch: any) => {
    if (ch.type === 'removed' || ch.doc.metadata.hasPendingWrites) return;
    const d = ch.doc.data(), id = ch.doc.id, last = st().last;
    if (d.deleted) { if (removeLocal(id)) changed = true; delete last[id]; return; }
    if (!d.data || !LISTS[d.kind]) return;
    const f = fp(d.data); if (last[id] === f) return;
    upsertLocal(d.kind, d.data); last[id] = f; changed = true;
    (d.data.files || []).forEach((x: any) => { last['f:' + x.id] = 1; }); // already online: never upload it again from here
  });
  if (!snap.metadata.fromCache) { lastOk = Date.now(); error = ''; }
  if (!ready && (st().primed || !snap.metadata.fromCache)) { ready = true; st().primed = true; changed = true; setTimeout(push, 0); }
  if (changed) { idbSet('state', S()); emit(); setTimeout(prefetch, 500); schedule(); }
  paint();
}
async function onVault(doc: any) {
  if (doc.metadata.hasPendingWrites) return;
  if (!doc.exists) { vaultSeen = true; schedule(); return; }
  const v = doc.data().vault || null, f = fp(v);
  if (st().last.__vault === f) { vaultSeen = true; return; }
  vaultSeen = true;
  const old = S().vault;
  if (v == null && old && st().last.__vault === undefined) { schedule(); return; } // never seen online before: keep ours and upload it
  S().vault = v; st().last.__vault = f;
  if (app.vaultKey) {
    if (v && old && v.salt === old.salt) await reopenWithKey();
    else { app.vaultKey = null; app.vaultNotes = []; }
  }
  await idbSet('state', S()); emit();
}
function listen() {
  unsub.forEach((u) => u());
  const fail = (e: any) => {
    error = e.code === 'permission-denied'
      ? 'You are signed in, but the online database refused access. Publish the security rule from step 4 of the setup guide; Dayline tries again every 30 seconds.'
      : 'Sync paused: ' + (e.message || e) + '. Trying again shortly.';
    paint();
    clearTimeout(retry); const u = user;
    retry = setTimeout(() => { if (user && user === u) { error = ''; listen(); paint(); } }, 30000);
  };
  unsub = [items().onSnapshot({ includeMetadataChanges: true }, onItems, fail), vaultDoc().onSnapshot(onVault, fail)];
}
function onUser(u: any) {
  user = u; ready = false; vaultSeen = false; unsub.forEach((f) => f()); unsub = [];
  if (u) {
    if (!S().sync || S().sync!.uid !== u.uid) { S().sync = { uid: u.uid, email: u.email, last: {}, primed: false }; idbSet('state', S()); }
    listen();
  }
  paint();
}

const MSG: Record<string, string> = {
  'auth/invalid-credential': 'That email and password do not match.',
  'auth/wrong-password': 'That email and password do not match.',
  'auth/user-not-found': 'There is no account with that email yet. Tap "Create account".',
  'auth/email-already-in-use': 'An account with that email already exists. Tap "Sign in" instead.',
  'auth/weak-password': 'Choose a password with at least 6 characters.',
  'auth/invalid-email': 'That email address does not look right.',
  'auth/network-request-failed': 'No internet connection. Try again when you are online.',
  'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.',
  'auth/operation-not-allowed': 'Email sign-in is not switched on yet (step 3 of the setup guide).',
};
const say = (e: any) => MSG[e.code] || e.message || String(e);

/** Redraws the sync part of Settings. */
function paint() { emit(); }

/* ---------- test copy: read the main app's online data (read-only) ---------- */
/** Everything the main Dayline app has synced online, or null when not signed in. Nothing is changed there. */
export async function fetchMainOnline() {
  if (!P || !user || !db) return null;
  const main = userDoc();
  const snap = await main.collection('items').get();
  const items: { kind: string; data: any }[] = [];
  snap.docs.forEach((d: any) => { const x = d.data(); if (x && !x.deleted && x.data && LISTS[x.kind]) items.push({ kind: x.kind, data: x.data }); });
  const v = await main.collection('meta').doc('vault').get();
  const vault = v.exists ? v.data().vault || null : null;
  /** Downloads one attached file from the main app's online space. */
  const getFile = async (id: string): Promise<FileRecord | null> => {
    const ref = main.collection('files').doc(id), m = await ref.get(); if (!m.exists) return null;
    const md = m.data(); let data = '';
    for (let i = 0; i < md.chunks; i++) { const c = await ref.collection('chunks').doc(String(i)).get(); if (!c.exists) return null; data += c.data().d; }
    return { name: md.name, type: md.type, size: md.size, blob: new Blob([unb64(data) as BlobPart], { type: md.type }) };
  };
  return { items, vault, getFile };
}

/* ---------- what Settings uses ---------- */
export function syncStatus() {
  return { configured: !!FIREBASE.apiKey, booted: !!auth, email: user?.email as string | undefined, signedIn: !!user, ready, error, lastOk };
}
async function run(fn: () => Promise<unknown>) { error = ''; try { await fn(); } catch (e) { error = say(e); paint(); } }
export const signIn = (email: string, pass: string) => run(() => auth.signInWithEmailAndPassword(email, pass));
export const createAccount = (email: string, pass: string) => run(() => auth.createUserWithEmailAndPassword(email, pass));
export const resetPassword = (email: string) => run(async () => { if (!email) throw { message: 'Type your email first.' }; await auth.sendPasswordResetEmail(email); });
export const signOut = () => auth?.signOut();

export async function startSync() {
  if (started || !FIREBASE.apiKey) return; started = true;
  onSave(schedule);
  onRemoteFetch(fetchFile);
  try { await boot(); auth.onAuthStateChanged(onUser); }
  catch { started = false; paint(); window.addEventListener('online', startSync, { once: true }); }
}

// For the automatic tests only.
if (typeof window !== 'undefined') (window as any).__daylineSync = { push, state: () => ({ user, ready, error }) };
