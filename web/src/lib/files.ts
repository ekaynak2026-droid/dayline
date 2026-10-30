'use client';
// Attached files and photos (PDF, Word, Excel, photos…) on tasks, events and notes.
// The item only lists its files: [{id, name, type, size}]. The file itself is stored under "file:<id>".

import { app, emit, idbDel, idbGet, toast } from './store';
import type { FileRecord, FileRef } from '@/types';
import { t } from './i18n';

export const MAXFILE = 10 * 1024 * 1024; // 10 MB
const DOC_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.rtf,.odt,.ods,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv';
export const ATTACH_ACCEPT = DOC_ACCEPT + ',image/*';

export const filesOf = (x: { files?: FileRef[] }) => x.files || [];
/** Puts a new list of files on a task, event or note. */
export function setFiles(x: { files?: FileRef[] }, files: FileRef[]) { x.files = [...files]; }
const fileKind = (n: string) => {
  const e = (String(n).split('.').pop() || '').toLowerCase();
  return e === 'pdf' ? 'PDF' : ['doc', 'docx', 'odt', 'rtf'].includes(e) ? 'Word'
    : ['xls', 'xlsx', 'csv', 'ods'].includes(e) ? 'Excel' : ['ppt', 'pptx'].includes(e) ? t('Slides')
    : e.toUpperCase().slice(0, 5) || t('File');
};
export const isImage = (f: { type: string; name: string }) => String(f.type).startsWith('image/') || /\.(jpe?g|png|gif|webp|heic)$/i.test(f.name);
export const kindOf = (f: FileRef) => (isImage(f) ? t('Photo') : fileKind(f.name));
export const sizeText = (b: number) => (b < 1048576 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1048576).toFixed(1) + ' MB');

export const blobToB64 = (b: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1] || '');
  r.onerror = () => rej(r.error);
  r.readAsDataURL(b);
});

// Sync registers here, so a file that is only online yet can be fetched when opened.
let remoteFetch: ((id: string) => Promise<FileRecord | null>) | null = null;
export function onRemoteFetch(f: typeof remoteFetch) { remoteFetch = f; }

export async function getFile(id: string): Promise<FileRecord | null> {
  let rec = await idbGet<FileRecord>('file:' + id);
  if (!rec && remoteFetch) rec = await remoteFetch(id).catch(() => null);
  return rec;
}

/** "Download": hands the file to the phone, which offers to open it in another app or save it. */
export function showBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.rel = 'noopener'; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}

/** Shows a file on screen in the viewer. */
export function viewBlob(blob: Blob, name: string, type: string) { app.viewer = { blob, name, type }; emit(); }

export async function openFile(f: FileRef) {
  const rec = await getFile(f.id);
  if (!rec) { toast(navigator.onLine ? 'This file has not reached this device yet. Try again in a moment.' : 'Connect to the internet to open this file on this device'); return; }
  viewBlob(rec.blob, f.name, rec.type || f.type);
}
export async function saveFileCopy(f: FileRef) {
  const rec = await getFile(f.id);
  if (!rec) { toast('This file is not on this device yet'); return; }
  showBlob(rec.blob, f.name);
}
export async function dropFiles(x: { files?: FileRef[] }) { for (const f of filesOf(x)) await idbDel('file:' + f.id); }

/** Big phone photos are made smaller (longest side 2000 px) so they save and sync quickly. */
export function shrinkImage(f: File): Promise<File> {
  return new Promise((res) => {
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(f.type) || f.size < 1.5e6) return res(f);
    const u = URL.createObjectURL(f), img = new Image();
    img.onload = () => {
      const sc = Math.min(1, 2000 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
      c.toBlob((b) => { if (!b) return res(f); res(new File([b], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })); }, 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(u); res(f); };
    img.src = u;
  });
}

/** The photo on a photo note is kept small (longest side 1200 px) inside the note itself. */
export function notePhoto(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const m = 1200, sc = Math.min(1, m / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = () => rej(new Error('not a photo'));
      img.src = String(r.result);
    };
    r.readAsDataURL(file);
  });
}

/** Saves the text as a file the phone can keep (backups, calendar files). */
export function download(name: string, text: string, type: string) {
  showBlob(new Blob([text], { type }), name);
}
