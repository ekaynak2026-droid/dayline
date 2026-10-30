// Sketch pad drafts, kept on this phone only (the phone's database, like attached files).
// The list is saved under "drafts" and each picture under "draft:<id>" as a PNG.
// To keep a drawing in sync on every device, the sketch pad can save it as a photo note.

import { idbDel, idbGet, idbSet } from './store';
import { uid } from './dates';
import { t } from './i18n';

export interface Draft { id: string; title: string; updated: number; paper: Paper }
export type Paper = 'plain' | 'grid' | 'dots';

/** Size of every drawing, in pixels. Portrait, roughly A-paper proportions. */
export const PAGE_W = 1200, PAGE_H = 1600;

export async function listDrafts(): Promise<Draft[]> {
  const l = await idbGet<Draft[]>('drafts');
  return Array.isArray(l) ? [...l].sort((a, b) => b.updated - a.updated) : [];
}
async function saveList(l: Draft[]) { await idbSet('drafts', l); }

export async function newDraft(n: number): Promise<Draft> {
  const d: Draft = { id: uid(), title: t('Draft {n}', { n }), updated: Date.now(), paper: 'grid' };
  await saveList([d, ...(await listDrafts())]);
  return d;
}
export async function updateDraft(d: Draft, png?: Blob) {
  d.updated = Date.now();
  if (png) await idbSet('draft:' + d.id, png);
  const l = await listDrafts();
  await saveList([d, ...l.filter((x) => x.id !== d.id)]);
}
export async function loadDraftImage(id: string): Promise<Blob | null> {
  const b = await idbGet<Blob>('draft:' + id);
  return b instanceof Blob ? b : null;
}
export async function deleteDraft(id: string) {
  await idbDel('draft:' + id);
  await saveList((await listDrafts()).filter((x) => x.id !== id));
}
