'use client';
// The "📂 Files and photos" box used in the edit windows, plus the 📂 button and file chips in lists.
// Nothing is stored until the window's Save runs commit().

import React, { useId, useState } from 'react';
import type { FileRecord, FileRef } from '@/types';
import { closeSheet, idbDel, idbSet, openSheet, save, toast } from '@/lib/store';
import { ATTACH_ACCEPT, MAXFILE, filesOf, kindOf, openFile, saveFileCopy, showBlob, shrinkImage, sizeText, viewBlob } from '@/lib/files';
import { uid } from '@/lib/dates';
import { setFiles as storeFiles } from '@/lib/files';
import { IconSave } from './icons';
import { Actions, Sheet, cls } from './ui';

export function useFileBox(initial: FileRef[]) {
  const [files, setFiles] = useState<FileRef[]>(() => [...initial]);
  const [pending] = useState(() => new Map<string, FileRecord>());
  /** Stores newly attached files and removes the ones taken off. */
  const commit = async (before: FileRef[]) => {
    for (const [id, rec] of pending) if (files.some((f) => f.id === id)) await idbSet('file:' + id, rec);
    for (const f of before) if (!files.some((x) => x.id === f.id)) await idbDel('file:' + f.id);
    pending.clear();
  };
  return { files, setFiles, pending, commit };
}
export type FileBoxCtl = ReturnType<typeof useFileBox>;

export function FileBox({ box, label = '📂 Files and photos' }: { box: FileBoxCtl; label?: string }) {
  const { files, setFiles, pending } = box;
  const inputId = 'fb-' + useId().replace(/:/g, '');
  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const added: FileRef[] = [];
    for (let f of Array.from(e.target.files || [])) {
      f = await shrinkImage(f);
      if (f.size > MAXFILE) { toast(`${f.name} is bigger than 10 MB`); continue; }
      const id = uid();
      pending.set(id, { name: f.name, type: f.type, size: f.size, blob: f });
      added.push({ id, name: f.name, type: f.type, size: f.size });
    }
    e.target.value = '';
    setFiles((cur) => [...cur, ...added]);
  };
  const preview = (f: FileRef) => { const p = pending.get(f.id); if (p) viewBlob(p.blob, f.name, p.type); else openFile(f); };
  const download = (f: FileRef) => { const p = pending.get(f.id); if (p) showBlob(p.blob, f.name); else saveFileCopy(f); };
  const remove = (f: FileRef) => { pending.delete(f.id); setFiles((cur) => cur.filter((x) => x.id !== f.id)); };

  return (
    <div>
      <label className={cls.label}>{label}</label>
      {/* Attached files on the left (tap to preview, ⬇ to download), the attach button on the right. */}
      <div className="flex gap-2.5 items-start mt-1.5">
        <ul className="flex-1 min-w-0 grid grid-cols-[minmax(0,1fr)] gap-1.5 m-0 p-0 list-none">
          {files.length === 0 && <li className="text-[14px] text-[var(--muted)] py-2.5">No files yet</li>}
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-1 min-w-0 border border-[var(--line)] rounded-xl bg-[var(--bg)] pl-1">
              <button type="button" onClick={() => preview(f)} aria-label={`Preview ${f.name}`} title={`${f.name} · ${sizeText(f.size)}`}
                className="flex-1 min-w-0 flex items-center gap-2 py-2 px-1.5 text-left cursor-pointer">
                <span className="flex-none text-[11px] font-bold uppercase tracking-wide text-[var(--accent)] bg-[var(--surface)] rounded-md px-1.5 py-0.5">{kindOf(f)}</span>
                <span className="truncate text-[14px] text-[var(--ink)]">{f.name}</span>
              </button>
              <button type="button" onClick={() => download(f)} aria-label={`Download ${f.name}`} className="flex-none w-9 h-9 flex items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"><IconSave /></button>
              <button type="button" onClick={() => remove(f)} aria-label={`Remove ${f.name}`} className="flex-none w-9 h-9 flex items-center justify-center text-[20px] text-[var(--muted)] hover:text-[var(--danger)] cursor-pointer">×</button>
            </li>
          ))}
        </ul>
        <label htmlFor={inputId} className="flex-none w-[104px] flex flex-col items-center justify-center gap-1 text-center border border-dashed border-[var(--muted)] rounded-xl p-2.5 text-[13px] font-semibold text-[var(--accent)] cursor-pointer hover:bg-[var(--bg)]">
          <span aria-hidden="true" className="text-[22px]">📂</span>
          <span>Attach file or photo</span>
        </label>
        <input type="file" id={inputId} accept={ATTACH_ACCEPT} multiple hidden onChange={onPick} />
      </div>
    </div>
  );
}

/* ---------- in the task and event lists ---------- */
type WithFiles = { id: string; files?: FileRef[]; text?: string; title?: string };

/** The 📂 button on each task and event row. Shows how many files are attached. */
export function FolderButton({ item }: { item: WithFiles }) {
  const n = filesOf(item).length;
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); openSheet(<FilesSheet key={item.id + Date.now()} item={item} />); }}
      aria-label={`Files and photos (${n})`}
      className={`flex-none h-8 min-w-8 px-1.5 rounded-lg flex items-center justify-center gap-0.5 cursor-pointer border ${n ? 'border-[var(--accent)] bg-[var(--bg)]' : 'border-transparent opacity-60 hover:opacity-100'}`}>
      <span aria-hidden="true" className="text-[16px] leading-none">📂</span>
      {n > 0 && <small className="text-[11px] font-bold text-[var(--accent)]">{n}</small>}
    </button>
  );
}

/** The attached files shown under a task or event; tap one to open it. */
export function FileChips({ item }: { item: WithFiles }) {
  const fl = filesOf(item);
  if (!fl.length) return null;
  return (
    <div className="basis-full flex flex-wrap gap-1.5 pb-2 pl-9 min-w-0">
      {fl.map((f) => (
        <button key={f.id} type="button" onClick={() => openFile(f)} className="max-w-full min-w-0 flex items-center gap-1.5 border border-[var(--line)] bg-[var(--bg)] rounded-full py-1 px-2.5 text-[13px] cursor-pointer hover:border-[var(--muted)]">
          <span className="flex-none text-[10.5px] font-bold uppercase text-[var(--accent)]">{kindOf(f)}</span>
          <span className="truncate text-[var(--ink)]">{f.name}</span>
        </button>
      ))}
    </div>
  );
}

/** Opened by the 📂 button: attach, preview, download or remove, then Save. */
function FilesSheet({ item }: { item: WithFiles }) {
  const box = useFileBox(filesOf(item));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await box.commit(filesOf(item));
    storeFiles(item, box.files);
    await save(); closeSheet(); toast('Files saved');
  };
  return (
    <Sheet>
      <h3 className={cls.h3}><span aria-hidden="true">📂</span> {item.text ?? item.title}</h3>
      <form onSubmit={submit}>
        <FileBox box={box} label="Files and photos" />
        <Actions />
      </form>
    </Sheet>
  );
}
