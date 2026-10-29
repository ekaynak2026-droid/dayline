'use client';
// Test copy only: "Copy my Dayline data" in Settings.
// Adds everything from the main Dayline app (on this device, and from the sync account if signed in)
// to the test copy: tasks, events, notes, attached files and locked notes. The main app is only read.
// Items that exist in both are updated to the main app's version; nothing in the test copy is removed.

import { app, idbGet, idbSet, readMainApp, save } from './store';
import { fetchMainOnline } from './sync';
import { lockVault } from './vault';
import type { CalendarEvent, FileRef, Note, State, Task } from '@/types';

type Item = Task | CalendarEvent | Note;
type ListName = 'tasks' | 'events' | 'notes';
const LISTS: Record<string, ListName> = { task: 'tasks', event: 'events', note: 'notes' };

export interface ImportResult { tasks: number; events: number; notes: number; files: number; missingFiles: number; locked: boolean; fromDevice: boolean; fromOnline: boolean }

export async function importFromMain(): Promise<ImportResult> {
  const r: ImportResult = { tasks: 0, events: 0, notes: 0, files: 0, missingFiles: 0, locked: false, fromDevice: false, fromOnline: false };
  // Collect the newest version of each item from both places.
  const found = new Map<string, [ListName, Item]>();
  const offer = (list: ListName, x: Item) => {
    const had = found.get(x.id);
    if (!had || (x.updated || 0) >= ((had[1] as { updated?: number }).updated || 0)) found.set(x.id, [list, x]);
  };
  const local = await readMainApp();
  let vault: State['vault'] = null;
  if (local) {
    r.fromDevice = true;
    (['tasks', 'events', 'notes'] as ListName[]).forEach((l) => (local.state[l] as Item[]).forEach((x) => offer(l, x)));
    vault = local.state.vault || null;
    for (const [k, v] of local.files) if (!(await idbGet(k))) { await idbSet(k, v); }
  }
  const online = await fetchMainOnline().catch(() => null);
  if (online) {
    r.fromOnline = true;
    online.items.forEach(({ kind, data }) => offer(LISTS[kind], data));
    if (online.vault) vault = online.vault; // the online copy is the one all devices share
  }

  // Add or update in the test copy.
  for (const [list, x] of found.values()) {
    const arr = app.S[list] as Item[];
    const i = arr.findIndex((y) => y.id === x.id);
    if (i >= 0) arr[i] = x; else arr.push(x);
    r[list]++;
  }
  // Attached files: anything not on this device yet comes from the main app's online space.
  const want: FileRef[] = [];
  for (const [, x] of found.values()) (x.files || []).forEach((f) => want.push(f));
  for (const f of want) {
    if (await idbGet('file:' + f.id)) { r.files++; continue; }
    const rec = online ? await online.getFile(f.id).catch(() => null) : null;
    if (rec) { await idbSet('file:' + f.id, rec); r.files++; } else r.missingFiles++;
  }
  // Locked notes: take the main app's (same PIN), if it has any.
  if (vault) { app.S.vault = vault; lockVault(); r.locked = true; }
  await save();
  return r;
}
