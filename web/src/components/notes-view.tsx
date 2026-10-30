'use client';
// The Notes tab: text notes, checklists and photo notes, plus locked (encrypted) notes for passwords.

import React, { useEffect, useRef, useState } from 'react';
import type { ChecklistItem, Note } from '@/types';
import { app, closeSheet, emit, idbDel, openSheet, save, toast, useApp } from '@/lib/store';
import { filesOf, notePhoto } from '@/lib/files';
import { lockVault, sealVault } from '@/lib/vault';
import { ago, uid } from '@/lib/dates';
import { getNoteFilter, setNoteFilter } from '@/lib/ui-state';
import { t } from '@/lib/i18n';
import { FileBox, useFileBox } from './file-box';
import { ensureVault } from './pin-sheet';
import { IconCamera, IconClip, IconList, IconLock, IconText } from './icons';
import { Actions, Sheet, cls } from './ui';

type Filter = 'all' | 'lists' | 'photos' | 'files';

function NoteCard({ n }: { n: Note }) {
  const fl = filesOf(n);
  const left = n.type === 'list' ? n.items.filter((i) => !i.done).length : 0;
  return (
    <button type="button" onClick={() => editNote(n, false)}
      className="bg-[var(--surface)] rounded-2xl p-3 flex flex-col gap-1.5 border border-[var(--line)] overflow-hidden cursor-pointer hover:border-[var(--muted)] text-left min-w-0">
      {/* eslint-disable-next-line @next/next/no-img-element -- the photo is stored inside the note */}
      {n.photo && <img src={n.photo} alt="" className="w-[calc(100%+24px)] max-w-none -mx-3 -mt-3 mb-0.5 aspect-[4/3] object-cover" />}
      <strong className="font-display font-semibold text-[16px] leading-tight text-[var(--ink)] break-words">{n.title || t('Untitled')}</strong>
      {n.type === 'list' ? (
        <>
          <ul className="list-none m-0 p-0 text-[13.5px] grid gap-1">
            {n.items.slice(0, 5).map((it, i) => (
              <li key={i} className={`flex gap-1.5 items-center min-w-0 ${it.done ? 'text-[var(--done)] line-through' : 'text-[var(--ink)]'}`}>
                <span className={`w-2.5 h-2.5 rounded-[3px] border flex-none ${it.done ? 'bg-[var(--done)] border-[var(--done)]' : 'border-[var(--muted)]'}`} />
                <span className="truncate">{it.t}</span>
              </li>
            ))}
          </ul>
          <span className="text-[12px] text-[var(--muted)]">{t('{left} of {n} left', { left, n: n.items.length })}</span>
        </>
      ) : n.body ? <p className="m-0 text-[13.5px] text-[var(--muted)] line-clamp-5 whitespace-pre-line break-words">{n.body}</p> : null}
      {fl.length > 0 && <span className="flex items-center gap-1 text-[12px] text-[var(--muted)] min-w-0"><IconClip /><span className="truncate">{fl.length === 1 ? fl[0].name : t('{n} files', { n: fl.length })}</span></span>}
      <span className="flex items-center gap-1 text-[12px] text-[var(--muted)]">{n.locked && <IconLock className="w-3.5 h-3.5" />}{ago(n.updated)}</span>
    </button>
  );
}

export function NotesView() {
  const { S, vaultKey, vaultNotes } = useApp();
  const [filter, setFilterState] = useState<Filter>(getNoteFilter);
  const setFilter = (f: Filter) => { setNoteFilter(f); setFilterState(f); };
  const open = [...S.notes].sort((a, b) => b.updated - a.updated);
  const locked = [...vaultNotes].sort((a, b) => b.updated - a.updated);
  const shown = open.filter((n) => filter === 'all' || (filter === 'lists' && n.type === 'list') || (filter === 'photos' && n.photo) || (filter === 'files' && filesOf(n).length));
  const emptyText = t(filter === 'photos' ? 'No photo notes yet. Tap + and choose "Photo note".'
    : filter === 'files' ? 'No files yet. Open a note or checklist and attach a file.'
    : filter === 'lists' ? 'No checklists yet. Tap + and choose "Checklist".'
    : 'No notes yet. Tap + to write one, like a shopping list.');
  const count = S.vault?.count || 0;

  return (
    <div className="pb-28">
      <header className="sticky top-0 z-10 bg-[var(--bg)] px-4 pt-[max(16px,env(safe-area-inset-top,0px))] pb-2.5">
        <h1 className="font-display font-extrabold text-[30px] tracking-[-0.02em] leading-none text-[var(--ink)]">{t('Notes')}</h1>
      </header>
      <div className="px-4">
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {([['all', 'All'], ['lists', 'Checklists'], ['photos', 'With photos'], ['files', 'With files']] as [Filter, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={cls.pill(filter === k)}>{t(l)}</button>
          ))}
        </div>
        {shown.length ? (
          <div className="grid grid-cols-2 gap-2.5 items-start">{shown.map((n) => <NoteCard key={n.id} n={n} />)}</div>
        ) : <p className="text-center text-[var(--muted)] py-8 text-sm">{emptyText}</p>}

        <div className="flex items-center justify-between mt-6 mb-2">
          <h2 className="flex items-center gap-2 font-display font-semibold text-lg text-[var(--ink)]"><IconLock className="w-5 h-5" /> {t('Locked notes')}</h2>
          {vaultKey && <button onClick={() => { lockVault(); emit(); toast('Locked'); }} className={cls.pill(false)}>{t('Lock now')}</button>}
        </div>
        {vaultKey ? (
          locked.length ? <div className="grid grid-cols-2 gap-2.5 items-start">{locked.map((n) => <NoteCard key={n.id} n={n} />)}</div>
            : <p className="text-center text-[var(--muted)] py-6 text-sm">{t('No locked notes yet. Tap + and choose "Locked note".')}</p>
        ) : (
          <button onClick={() => ensureVault(emit)} className={cls.choice + ' bg-[var(--surface)]'}>
            <span className={cls.choiceIco + ' bg-[var(--bg)]'}><IconLock /></span>
            <span>
              <b className="block text-[var(--ink)] text-[15px]">{S.vault ? (count === 1 ? t('1 locked note') : t('{n} locked notes', { n: count })) : t('Set up locked notes')}</b>
              <span className="text-[13.5px] text-[var(--muted)]">{t(S.vault ? 'Tap and enter your PIN to open' : 'For passwords, codes and other private things. Choose a 6-digit PIN.')}</span>
            </span>
          </button>
        )}
        <p className="text-[12.5px] text-[var(--muted)] mt-3">{t('Locked notes are encrypted on this phone with your PIN. Nobody, including me, can open them without it, so keep your PIN somewhere safe. They lock again a minute after you leave the app.')}</p>
      </div>
    </div>
  );
}

/* ---------- new note ---------- */
export function newNoteChooser() { openSheet(<NoteChooser key={Date.now()} />); }

type Kind = 'text' | 'list' | 'photo' | 'locked';
function startNote(k: Kind) {
  const n: Note = { id: uid(), type: k === 'list' ? 'list' : 'text', title: '', body: '', items: [], photo: null, locked: k === 'locked', updated: Date.now() };
  if (k === 'locked') ensureVault(() => editNote(n, true));
  else editNote(n, true, k === 'photo');
}
function NoteChooser() {
  const make = startNote;
  const opts: [Kind, React.ReactNode, string, string][] = [
    ['text', <IconText key="t" />, 'Text note', 'Anything to remember for later'],
    ['list', <IconList key="l" />, 'Checklist', 'Shopping lists, packing lists, things to buy'],
    ['photo', <IconCamera key="c" />, 'Photo note', 'A picture with a few words, like a parking spot or a receipt'],
    ['locked', <IconLock key="k" />, 'Locked note', 'Passwords and codes, encrypted with your PIN'],
  ];
  return (
    <Sheet>
      <h3 className={cls.h3}>{t('New note')}</h3>
      <div className="grid gap-2.5">
        {opts.map(([k, ico, title, s]) => (
          <button key={k} type="button" onClick={() => make(k)} className={cls.choice}>
            <span className={cls.choiceIco}>{ico}</span>
            <span><b className="block text-[var(--ink)] text-[15px]">{t(title)}</b><span className="text-[13.5px] text-[var(--muted)]">{t(s)}</span></span>
          </button>
        ))}
      </div>
      <div className="flex justify-end mt-4"><button type="button" onClick={closeSheet} className={cls.ghost}>{t('Cancel')}</button></div>
    </Sheet>
  );
}

/* ---------- saving notes (open or locked) ---------- */
async function storeNote(w: Note) {
  const wasLocked = app.vaultNotes.some((x) => x.id === w.id);
  app.S.notes = app.S.notes.filter((x) => x.id !== w.id);
  app.vaultNotes = app.vaultNotes.filter((x) => x.id !== w.id);
  if (w.locked) app.vaultNotes.push(w); else app.S.notes.push(w);
  if (w.locked || wasLocked) await sealVault(); else await save();
}
async function removeNote(w: Note) {
  for (const f of filesOf(w)) await idbDel('file:' + f.id);
  const wasLocked = app.vaultNotes.some((x) => x.id === w.id);
  app.S.notes = app.S.notes.filter((x) => x.id !== w.id);
  app.vaultNotes = app.vaultNotes.filter((x) => x.id !== w.id);
  if (wasLocked) await sealVault(); else await save();
}

/* ---------- edit note ---------- */
export function editNote(n: Note, isNew: boolean, pickPhoto = false) { openSheet(<NoteSheet key={n.id + Date.now()} note={n} isNew={isNew} pickPhoto={pickPhoto} />); }

function NoteSheet({ note, isNew, pickPhoto }: { note: Note; isNew: boolean; pickPhoto: boolean }) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [items, setItems] = useState<(ChecklistItem & { k: string })[]>(() =>
    (note.items?.length ? note.items : [{ t: '', done: false }]).map((i) => ({ ...i, k: uid() })));
  const [photo, setPhoto] = useState<string | null>(note.photo);
  const [locked, setLocked] = useState(!!note.locked);
  const box = useFileBox(filesOf(note));
  const photoInput = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const isList = note.type === 'list';
  const heading = t(isNew ? (isList ? 'New checklist' : pickPhoto ? 'New photo note' : note.locked ? 'New locked note' : 'New note') : 'Edit note');

  // A new photo note opens the camera / photo picker straight away.
  useEffect(() => { if (pickPhoto) { const t = setTimeout(() => photoInput.current?.click(), 50); return () => clearTimeout(t); } }, [pickPhoto]);

  const focusItem = (k: string) => setTimeout(() => listRef.current?.querySelector<HTMLInputElement>(`[data-k="${k}"]`)?.focus(), 0);
  const addItem = (after?: number) => {
    const it = { t: '', done: false, k: uid() };
    setItems((cur) => { const c = [...cur]; c.splice(after === undefined ? c.length : after + 1, 0, it); return c; });
    focusItem(it.k);
  };
  const setItem = (i: number, patch: Partial<ChecklistItem>) => setItems((cur) => cur.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    try { setPhoto(await notePhoto(f)); } catch { toast('That file is not a photo Dayline can read'); }
  };
  const onLock = (v: boolean) => {
    if (v && box.files.length) { toast('Notes with files cannot be locked yet. Remove the files first.'); return; }
    setLocked(v);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const w: Note = JSON.parse(JSON.stringify(note));
    w.title = title.trim();
    if (isList) w.items = items.map(({ t, done }) => ({ t: t.trim(), done })).filter((i) => i.t);
    else w.body = body;
    w.items = w.items || [];
    w.photo = photo;
    if (!w.title && !w.body && !w.items.length && !w.photo && !box.files.length) { toast('Write something first'); return; }
    w.locked = locked; w.updated = Date.now(); w.files = [...box.files];
    const done = async () => {
      try { await box.commit(filesOf(note)); await storeNote(w); closeSheet(); toast(w.locked ? 'Saved and locked' : 'Note saved'); }
      catch { toast('Could not save the note'); }
    };
    if (w.locked && !app.vaultKey) ensureVault(done); else done();
  };
  const del = async () => { await removeNote(note); closeSheet(); toast('Note deleted'); };

  return (
    <Sheet>
      <h3 className={cls.h3}>{heading}</h3>
      <form onSubmit={submit} className="grid gap-1.5">
        <label htmlFor="fn-title" className={cls.label}>{t('Title')}</label>
        <input id="fn-title" autoFocus={isNew && !pickPhoto} value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" className={cls.input}
          placeholder={t(isList ? 'e.g. Shopping list' : note.locked ? 'e.g. Bank app login' : 'e.g. Where I parked')} />
        {isList ? (
          <>
            <span className={cls.label}>{t('Items')}</span>
            <ul ref={listRef} className="list-none m-0 p-0 grid gap-1.5">
              {items.map((it, i) => (
                <li key={it.k} className="flex items-center gap-2">
                  <input type="checkbox" checked={it.done} onChange={(e) => setItem(i, { done: e.target.checked })} aria-label={t('Done')} className="w-5 h-5 flex-none accent-[var(--accent)]" />
                  <input data-k={it.k} value={it.t} onChange={(e) => setItem(i, { t: e.target.value })} placeholder={t('Item')} aria-label={t('Item')} enterKeyHint="next"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(i); } }} className={cls.input + ' p-2.5'} />
                  <button type="button" onClick={() => setItems((cur) => cur.filter((x) => x.k !== it.k))} aria-label={t('Remove item')} className="flex-none w-9 h-9 text-[20px] text-[var(--muted)] cursor-pointer">×</button>
                </li>
              ))}
            </ul>
            <div><button type="button" onClick={() => addItem()} className={cls.link + ' py-2'}>{t('+ Add item')}</button></div>
          </>
        ) : (
          <>
            <label htmlFor="fn-body" className={cls.label}>{t('Note')}</label>
            <textarea id="fn-body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('Write anything…')} className={cls.input + ' resize-y'} />
          </>
        )}

        <div className="grid gap-2 mt-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- the photo is stored inside the note */}
          {photo && <img src={photo} alt={t('Attached photo')} className="w-full max-h-[260px] object-cover rounded-xl" />}
          <div className="flex items-center gap-3 flex-wrap">
            <label htmlFor="fn-file" className="inline-flex items-center gap-2 border border-[var(--line)] rounded-xl py-2.5 px-3.5 font-semibold text-[var(--accent)] cursor-pointer bg-[var(--bg)]">
              <IconCamera /> <span>{t(photo ? 'Change photo' : 'Attach a photo')}</span>
            </label>
            <input ref={photoInput} type="file" id="fn-file" accept="image/*" hidden onChange={onPhoto} />
            {photo && <button type="button" onClick={() => setPhoto(null)} className={cls.ghost}>{t('Remove photo')}</button>}
          </div>
        </div>

        {!locked && <FileBox box={box} label="📂 Files" />}

        <label className="flex items-center gap-2.5 mt-3 text-[14.5px] text-[var(--ink)] cursor-pointer">
          <input type="checkbox" checked={locked} onChange={(e) => onLock(e.target.checked)} className="w-5 h-5 accent-[var(--accent)]" />
          {t('Keep in locked notes (encrypted, needs your PIN)')}
        </label>
        <Actions onDelete={isNew ? undefined : del} />
      </form>
    </Sheet>
  );
}
