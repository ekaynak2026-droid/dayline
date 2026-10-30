'use client';
// Brings in data from the other copy of Dayline (see OTHER_DB / OTHER_PREFIX in config.ts):
// tasks, events, notes, attached files and locked notes, from this device and, when signed in,
// from the sync account. The other copy is only read, never changed.
//
// - Test copy: the "Copy my Dayline data" button in Settings (reads the main app).
// - Main app: runs by itself once per device, so anything entered in the test version
//   (which ran at /dayline/test/ before this version went live) is kept.
//
// Nothing is removed. When an item exists in both, the newer one is kept.

import { app, idbGet, idbSet, readOtherCopy, save } from './store';
import { fetchOtherOnline } from './sync';
import { lockVault } from './vault';
import { TEST } from './config';
import type { CalendarEvent, FileRef, Note, State, Task } from '@/types';

type Item = Task | CalendarEvent | Note;
type ListName = 'tasks' | 'events' | 'notes';
const LISTS: Record<string, ListName> = { task: 'tasks', event: 'events', note: 'notes' };
const upd = (x: Item) => (x as { updated?: number }).updated || 0;

export interface ImportResult { tasks: number; events: number; notes: number; files: number; missingFiles: number; locked: boolean; fromDevice: boolean; fromOnline: boolean }

export async function importFromOther(opts: { device?: boolean; online?: boolean } = { device: true, online: true }): Promise<ImportResult> {
  const r: ImportResult = { tasks: 0, events: 0, notes: 0, files: 0, missingFiles: 0, locked: false, fromDevice: false, fromOnline: false };
  // Collect the newest version of each item from both places.
  const found = new Map<string, [ListName, Item]>();
  const offer = (list: ListName, x: Item) => {
    const had = found.get(x.id);
    if (!had || upd(x) >= upd(had[1])) found.set(x.id, [list, x]);
  };
  let vault: State['vault'] = null;
  const local = opts.device ? await readOtherCopy() : null;
  if (local) {
    r.fromDevice = true;
    (['tasks', 'events', 'notes'] as ListName[]).forEach((l) => ((local.state[l] || []) as Item[]).forEach((x) => offer(l, x)));
    vault = local.state.vault || null;
    for (const [k, v] of local.files) if (!(await idbGet(k))) await idbSet(k, v);
  }
  const online = opts.online ? await fetchOtherOnline().catch(() => null) : null;
  if (online) {
    r.fromOnline = true;
    online.items.forEach(({ kind, data }) => offer(LISTS[kind], data));
    if (online.vault) vault = online.vault; // the online copy is the one all devices share
  }

  // Add new items; update existing ones only when the other copy's version is at least as new.
  const added: Item[] = [];
  for (const [list, x] of found.values()) {
    const arr = app.S[list] as Item[];
    const i = arr.findIndex((y) => y.id === x.id);
    if (i < 0) { arr.push(x); added.push(x); r[list]++; }
    else if (upd(x) >= upd(arr[i]) && JSON.stringify(arr[i]) !== JSON.stringify(x)) { arr[i] = x; added.push(x); r[list]++; }
  }
  // Attached files: anything not on this device yet comes from the other copy's online space.
  const want: FileRef[] = [];
  for (const [, x] of found.values()) (x.files || []).forEach((f) => want.push(f));
  for (const f of want) {
    if (await idbGet('file:' + f.id)) { r.files++; continue; }
    const rec = online ? await online.getFile(f.id).catch(() => null) : null;
    if (rec) { await idbSet('file:' + f.id, rec); r.files++; } else r.missingFiles++;
  }
  // Locked notes are encrypted, so they can't be mixed. The test copy takes the main app's;
  // the main app keeps its own and only takes the test copy's if it has none.
  if (vault && (TEST || !app.S.vault) && JSON.stringify(vault) !== JSON.stringify(app.S.vault)) { app.S.vault = vault; lockVault(); r.locked = true; }
  if (added.length || r.locked) await save();
  return r;
}
