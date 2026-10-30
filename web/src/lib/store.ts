'use client';
// The app's memory and storage.
//
// Everything lives in one object, app.S (tasks, events, notes, locked notes…), which is saved to the
// phone's built-in database (IndexedDB) under the key "state" — the same format as the original
// Dayline, so data moves between the two without changes. Attached files are saved separately
// under "file:<id>" so that saving the main bundle stays fast.
//
// Screens call save() after changing app.S; that stores it, tells sync, and redraws the screen.

import { useSyncExternalStore, type ReactNode } from 'react';
import type { State, Note } from '@/types';
import { DB_NAME, OTHER_DB } from './config';

export const empty = (): State => ({
  v: 1, tasks: [], events: [], notes: [], vault: null, fired: {},
  installDismissed: false, lastBackup: null, sync: null,
});

export interface ViewerDoc { blob: Blob; name: string; type: string }

export const app = {
  S: empty(),
  /** The key that opens locked notes, only while they are unlocked. */
  vaultKey: null as CryptoKey | null,
  /** Locked notes, decrypted, only while unlocked. */
  vaultNotes: [] as Note[],
  /** The edit window (bottom sheet) on screen, if any. */
  sheet: null as ReactNode,
  /** The file shown in the viewer, if any. */
  viewer: null as ViewerDoc | null,
  toast: '',
  loaded: false,
};

/* ---------- redrawing ---------- */
let version = 0;
const subs = new Set<() => void>();
/** Tell the screen that something changed. */
export function emit() { version++; subs.forEach((f) => f()); }
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
/** Used by screens: redraws them whenever emit() runs. */
export function useApp() {
  useSyncExternalStore(subscribe, () => version, () => 0);
  return app;
}

/* ---------- small messages at the bottom of the screen ---------- */
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string) {
  app.toast = msg; emit();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { app.toast = ''; emit(); }, 2200);
}

/* ---------- edit windows ---------- */
export function openSheet(node: ReactNode) { app.sheet = node; emit(); }
export function closeSheet() { app.sheet = null; emit(); }

/* ---------- the phone's database ---------- */
function openDb(name: string): Promise<IDBDatabase | null> {
  return new Promise((res) => {
    try {
      const r = indexedDB.open(name, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch { res(null); }
  });
}
let dbp: Promise<IDBDatabase | null> | null = null;
const db = () => (dbp ||= openDb(DB_NAME));

export async function idbGet<T = unknown>(k: string): Promise<T | null> {
  const d = await db();
  if (!d) { try { return JSON.parse(localStorage.getItem(DB_NAME + '-' + k) || 'null'); } catch { return null; } }
  return new Promise((res) => {
    const q = d.transaction('kv').objectStore('kv').get(k);
    q.onsuccess = () => res((q.result as T) ?? null);
    q.onerror = () => res(null);
  });
}
export async function idbSet(k: string, v: unknown): Promise<void> {
  const d = await db();
  if (!d) { localStorage.setItem(DB_NAME + '-' + k, JSON.stringify(v)); return; }
  return new Promise((res, rej) => {
    const t = d.transaction('kv', 'readwrite');
    t.objectStore('kv').put(v, k);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}
export async function idbDel(k: string): Promise<void> {
  const d = await db();
  if (!d) return;
  return new Promise((res) => {
    const t = d.transaction('kv', 'readwrite');
    t.objectStore('kv').delete(k);
    t.oncomplete = () => res();
    t.onerror = () => res();
  });
}

/* ---------- saving ---------- */
let afterSave: (() => void) | null = null;
/** Sync registers here so it hears about every change. */
export function onSave(f: () => void) { afterSave = f; }
let askedPersist = false;
export async function save() {
  try { await idbSet('state', app.S); } catch { toast('Could not save. Your phone may be out of space.'); }
  afterSave?.();
  emit();
  // Ask the browser to never clear Dayline's storage on its own.
  if (!askedPersist && navigator.storage?.persist) { askedPersist = true; navigator.storage.persist().catch(() => {}); }
}

/* ---------- start-up ---------- */
// Test copy only: open the main app's database without creating it if it isn't there.
function openExisting(name: string): Promise<IDBDatabase | null> {
  return new Promise((res) => {
    try {
      const r = indexedDB.open(name);
      r.onupgradeneeded = () => r.transaction?.abort(); // it did not exist: don't create it
      r.onsuccess = () => res(r.result.objectStoreNames.contains('kv') ? r.result : (r.result.close(), null));
      r.onerror = () => res(null);
      r.onblocked = () => res(null);
    } catch { res(null); }
  });
}
/** Reads the other copy's data on this device (see OTHER_DB in config.ts). Nothing is changed there. */
export async function readOtherCopy(): Promise<{ state: State; files: [string, unknown][] } | null> {
  const src = await openExisting(OTHER_DB);
  if (!src) return null;
  const all: [IDBValidKey, unknown][] = await new Promise((res) => {
    try {
      const st = src.transaction('kv').objectStore('kv');
      const kq = st.getAllKeys(), vq = st.getAll();
      vq.onsuccess = () => res((kq.result || []).map((k, i) => [k, vq.result[i]]));
      vq.onerror = () => res([]);
    } catch { res([]); }
  });
  src.close();
  const state = all.find(([k]) => k === 'state')?.[1] as State | undefined;
  if (!state) return null;
  return { state, files: all.filter(([k]) => typeof k === 'string' && k.startsWith('file:')) as [string, unknown][] };
}
/** First start with an empty database: copies the other copy's data from this device. */
async function copyFromOtherCopy(): Promise<boolean> {
  const main = await readOtherCopy();
  if (!main) return false;
  for (const [k, v] of main.files) await idbSet(k, v);
  // Start with sync switched off: this copy signs in on its own and uses its own online space.
  app.S = { ...empty(), ...main.state, sync: null };
  await idbSet('state', app.S);
  return true;
}

export async function loadState() {
  const saved = await idbGet<State>('state');
  let copied = false;
  if (saved) app.S = { ...empty(), ...saved };
  else copied = await copyFromOtherCopy();
  app.loaded = true;
  emit();
  return { copied };
}
