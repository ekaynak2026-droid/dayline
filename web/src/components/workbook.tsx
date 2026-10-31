'use client';
// The AI task workbook in the Notes tab (see lib/workbook.ts): the card with its buttons, and the
// full-screen editor where every cell can be changed and saved.

import React, { useEffect, useRef, useState } from 'react';
import { closeSheet, openSheet, save, toast, useApp } from '@/lib/store';
import { showBlob, viewBlob } from '@/lib/files';
import { aiEnabled } from '@/lib/ai';
import { FILE_NAME, UPDATE_HOUR, dayText, deleteWorkbook, nextUpdateText, readWorkbook, stopWorkbook, storeWorkbookFile, updateWorkbook, wbStatus, workbookBlob, workbookNote, xlsx } from '@/lib/workbook';
import { t } from '@/lib/i18n';
import { openSettings } from './settings-sheet';
import { cls } from './ui';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function WorkbookCard() {
  const { S } = useApp();
  const note = S.notes.find((n) => n.book === 'workbook') || null;
  const on = aiEnabled();
  const pick = useRef<HTMLInputElement>(null);
  if (!note && !on) {
    return (
      <div className="bg-[var(--surface)] border border-dashed border-[var(--line)] rounded-2xl px-3.5 py-3 text-[14px] text-[var(--muted)] grid gap-1.5">
        <span>{t('Turn on the AI assistant in Settings, and it can keep an Excel workbook of your tasks here: a progress table, and for each task a summary of its files and a list of what to prepare.')}</span>
        <span><button type="button" onClick={openSettings} className={cls.link}>{t('Open Settings')}</button></span>
      </div>
    );
  }

  const run = async () => { if (await updateWorkbook()) toast(note ? 'Workbook updated' : 'Workbook made. Find it here in Notes.'); };
  const busy = wbStatus.running;
  const progress = busy && (wbStatus.total ? t('Updating… {a} of {b} tasks', { a: wbStatus.done, b: wbStatus.total }) : t('Updating…'));

  const download = async () => {
    const b = await workbookBlob();
    if (!b) { toast(navigator.onLine ? 'The workbook has not reached this device yet. Try again in a moment.' : 'Connect to the internet to open this file on this device'); return; }
    showBlob(b, FILE_NAME);
  };
  const putBack = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f || !note) return;
    if (busy) { toast('Wait until the update has finished'); return; }
    let ok = false;
    try { ok = !!(await readWorkbook(f)); } catch { /* not a spreadsheet */ }
    if (!ok) { toast('This is not the Dayline task workbook. Choose the file you downloaded from here.'); return; }
    await storeWorkbookFile(note, f); await save();
    toast('Your copy is saved. The assistant will follow your changes from the next update.');
  };
  const remove = async () => {
    if (!note || !confirm(t('Delete the workbook? Your edits in it will be lost. You can make a new one at any time.'))) return;
    await deleteWorkbook(); toast('Workbook deleted');
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-3.5 grid gap-2.5">
      {note ? (
        <button type="button" onClick={() => openEditor()} className="flex items-center gap-3 text-left cursor-pointer min-w-0">
          <span className="flex-none w-[42px] h-[42px] rounded-xl bg-[#1D6F42] text-white font-bold text-[13px] flex items-center justify-center" aria-hidden="true">XLS</span>
          <span className="min-w-0">
            <b className="block text-[var(--ink)] text-[15px] truncate">{FILE_NAME}</b>
            <span className="block text-[13px] text-[var(--muted)]">
              {note.body}{note.wb?.last ? ' · ' + t('updated {when}', { when: dayText(note.wb.last) }) : ''}
            </span>
          </span>
        </button>
      ) : (
        <p className="m-0 text-[14.5px] text-[var(--ink)]">{t('The assistant copies your tasks into an Excel workbook: a progress table, and a tab for each task with a summary of its attached files and a list of the materials and conditions to prepare. You can change anything in it; the assistant follows your changes.')}</p>
      )}
      <div className="flex gap-2 flex-wrap items-center">
        {note && <button type="button" onClick={() => openEditor()} disabled={busy} className={cls.primary}>{t('Open and edit')}</button>}
        <button type="button" onClick={run} disabled={busy || !on} className={note ? cls.pill(false) + ' disabled:opacity-50' : cls.primary}>{t(note ? 'Update now' : 'Make the workbook')}</button>
        {busy && <button type="button" onClick={stopWorkbook} className={cls.ghost}>{t('Stop')}</button>}
      </div>
      {busy && <p className="m-0 text-[13.5px] text-[var(--muted)]" role="status">{progress}</p>}
      {wbStatus.error && !busy && <p role="alert" className="m-0 text-[var(--danger)] text-[14px] font-semibold">{wbStatus.error}</p>}
      {note && (
        <div className="flex gap-x-4 gap-y-2 flex-wrap">
          <button type="button" onClick={download} className={cls.link}>{t('Download for Excel')}</button>
          <button type="button" onClick={() => pick.current?.click()} className={cls.link}>{t('Put back my edited copy')}</button>
          <input ref={pick} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={putBack} />
          <button type="button" onClick={remove} className={cls.link + ' !text-[var(--muted)]'}>{t('Delete')}</button>
        </div>
      )}
      <p className="m-0 text-[12.5px] text-[var(--muted)]">
        {note && on ? nextUpdateText(note) + ' ' : ''}
        {t('It updates every day at {h}:00 with new and changed tasks, but only while Dayline is open on one of your devices. If Dayline was closed at {h}:00, the update runs the next time you open it. Task texts and attached files are sent to Google Gemini for this.', { h: UPDATE_HOUR })}
      </p>
    </div>
  );
}

/* ---------- the editor ---------- */
export function openEditor() { openSheet(<WorkbookEditor key={Date.now()} />); }

interface SheetData { name: string; rows: string[][]; cols: any; merges: any[] }
function insertRow(d: SheetData, r: number) {
  d.rows.splice(r, 0, Array(d.rows[0]?.length || 1).fill(''));
  d.merges = d.merges.map((m) => (m.s.r >= r ? { s: { ...m.s, r: m.s.r + 1 }, e: { ...m.e, r: m.e.r + 1 } } : m));
}
function putCell(d: SheetData, ri: number, ci: number, v: string) { d.rows[ri][ci] = v; }

function WorkbookEditor() {
  const data = useRef<SheetData[] | null>(null);   // the cells, changed as you type
  const [sheets, setSheets] = useState<SheetData[] | null>(null);
  const [err, setErr] = useState('');
  const [at, setAt] = useState(0);
  const [ver, setVer] = useState(0);         // redraws the cells after a row is added
  const [dirty, setDirty] = useState(false);
  const sel = useRef(-1);                    // the row last tapped
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    (async () => {
      try {
        const b = await workbookBlob();
        if (!b) { setErr(t('The workbook has not reached this device yet. Try again in a moment.')); return; }
        const X = await xlsx();
        const wb = X.read(new Uint8Array(await b.arrayBuffer()), { type: 'array' });
        const all: SheetData[] = wb.SheetNames.map((name: string) => {
          const ws = wb.Sheets[name];
          const rows = (X.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: true }) as unknown[][]).map((r) => r.map((c) => String(c ?? '')));
          const w = Math.max(1, ...rows.map((r) => r.length));
          return { name, rows: rows.map((r) => [...r, ...Array(w - r.length).fill('')]), cols: ws['!cols'], merges: ws['!merges'] || [] };
        });
        data.current = all; setSheets(all.map((x) => ({ ...x, rows: x.rows.map((r) => [...r]) })));
      } catch { setErr(t('Dayline could not read this file. It may be damaged or password-protected.')); }
    })();
  }, []);

  const close = () => { if (dirty && !confirm(t('Close without saving your changes?'))) return; closeSheet(); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  });

  const sh = sheets?.[at];
  const addRow = () => {
    const d = data.current?.[at]; if (!d) return;
    const r = sel.current >= 0 ? sel.current + 1 : d.rows.length;
    insertRow(d, r);
    sel.current = r; setDirty(true); setVer((v) => v + 1);
    setSheets(data.current!.map((x) => ({ ...x, rows: x.rows.map((row) => [...row]) })));
  };
  const setCell = (ri: number, ci: number, v: string) => { const d = data.current?.[at]; if (d) putCell(d, ri, ci, v); };
  const saveAll = async () => {
    const note = workbookNote();
    const all = data.current;
    if (!all || !note) return;
    if (wbStatus.running) { toast('Wait until the update has finished'); return; }
    const X = await xlsx(), wb = X.utils.book_new();
    for (const s of all) {
      // Keep empty cells empty, and numbers as numbers.
      const ws = X.utils.aoa_to_sheet(s.rows.map((r) => r.map((c) => (c === '' ? null : /^-?\d+(\.\d+)?$/.test(c) ? Number(c) : c))));
      if (s.cols) ws['!cols'] = s.cols;
      if (s.merges.length) ws['!merges'] = s.merges;
      X.utils.book_append_sheet(wb, ws, s.name);
    }
    await storeWorkbookFile(note, new Blob([X.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    await save(); setDirty(false); closeSheet();
    toast('Saved. The assistant will follow your changes from the next update.');
  };
  const view = async () => { const b = await workbookBlob(); if (b) viewBlob(b, FILE_NAME, b.type); };

  // Cells covered by a merged cell are not drawn; the merged one spans them.
  const hidden = new Set<string>(), span = new Map<string, number>();
  sh?.merges.forEach((m) => {
    span.set(m.s.r + ':' + m.s.c, m.e.c - m.s.c + 1);
    for (let r = m.s.r; r <= m.e.r; r++) for (let c = m.s.c; c <= m.e.c; c++) if (r !== m.s.r || c !== m.s.c) hidden.add(r + ':' + c);
  });

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={t('AI task workbook')}>
      <header className="vbar">
        <button ref={closeRef} type="button" onClick={close} aria-label={t('Close')} className="w-[38px] h-[38px] rounded-xl flex items-center justify-center border border-[var(--line)] bg-[var(--surface)] text-[24px] leading-none flex-none cursor-pointer">×</button>
        <b className="vname">{t('AI task workbook')}</b>
        <button type="button" onClick={saveAll} disabled={!sheets} className={cls.primary + ' py-2 px-4'}>{t('Save')}</button>
      </header>
      <div className="vbody !items-stretch">
        {err && <p className="vmsg">{err}</p>}
        {!sheets && !err && <p className="vmsg">{t('Opening…')}</p>}
        {sheets && (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1 flex-none">
              {sheets.map((s, i) => <button key={s.name} type="button" onClick={() => { setAt(i); sel.current = -1; }} className={cls.pill(i === at)}>{s.name}</button>)}
            </div>
            <p className="m-0 text-[13px] text-[var(--muted)]">{t('Tap a cell to change it. Your changes are kept at every update, and the assistant follows them. Write extra wishes in "Your notes for the assistant" at the bottom of a task tab.')}</p>
            <div className="flex gap-4 flex-wrap flex-none">
              <button type="button" onClick={addRow} className={cls.link}>{t('+ Add a row below the one I tapped')}</button>
              <button type="button" onClick={view} disabled={dirty} className={cls.link + ' disabled:opacity-40'}>{t('Preview')}</button>
            </div>
            {sh && (
              <div className="vsheet !self-stretch !max-w-none">
                <table key={at + ':' + ver}>
                  <tbody>
                    {sh.rows.map((r, ri) => (
                      <tr key={ri}>
                        {r.map((c, ci) => hidden.has(ri + ':' + ci) ? null : (
                          <td key={ci} colSpan={span.get(ri + ':' + ci)} contentEditable suppressContentEditableWarning
                            onFocus={() => { sel.current = ri; }}
                            onInput={(e) => { setCell(ri, ci, (e.currentTarget.innerText || '').replace(/\n$/, '')); if (!dirty) setDirty(true); }}
                            style={{ whiteSpace: 'pre-wrap', minWidth: ci === 0 ? 40 : 120, maxWidth: 360, verticalAlign: 'top' }}
                            className="outline-none focus:bg-[#fff8dc]">{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
