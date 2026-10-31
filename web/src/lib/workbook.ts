'use client';
// The AI task workbook: an Excel file kept in the Notes tab, made by the AI assistant from the tasks.
//
// It has a "Progress" sheet (one row per task) and one sheet (tab) per task with:
//   a summary of the task and of its attached files, a summary of each file, the list of materials and
//   conditions to prepare before doing the task, and a box "Your notes for the assistant".
//
// The user may change anything in it, in the app (Open and edit) or in Excel (Download, edit, then
// "Put back my edited copy"). The user's edits win: on each update the app compares the workbook with
// what the assistant wrote last time (kept in the note, see WorkbookMeta in types). Whatever differs is
// the user's, is kept exactly as it is, and is given to the assistant as the truth to build on. Rows the
// user deleted are remembered and never suggested again.
//
// It updates by itself at 20:00 every day. Dayline is a website with no server of its own, so this can
// only happen while the app is open on a device; if 20:00 passed while it was closed, the update runs the
// next time it is opened. Only new and changed tasks (and tabs the user edited) are sent to Gemini.

import type { FileRef, Note, Task, WorkbookMeta, WorkbookTaskMeta } from '@/types';
import { app, emit, idbDel, idbSet, save } from './store';
import { blobToB64, filesOf, getFile, isImage } from './files';
import { AiError, aiEnabled, askAiJson, type AiPart } from './ai';
import { loadVendor } from './vendor';
import { asset } from './config';
import { addDays, fmt, fromIso, iso, todayDate, todayIso, uid } from './dates';
import { bothLangs, t } from './i18n';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const UPDATE_HOUR = 20;
export const FILE_NAME = 'Dayline task workbook.xlsx';
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_TASKS = 40;

export const isWorkbook = (n: Note) => n.book === 'workbook';
export const workbookNote = () => app.S.notes.find(isWorkbook) || null;

/* ---------- what the screen shows while an update runs ---------- */
export const wbStatus = { running: false, done: 0, total: 0, error: '' };
let ctl: AbortController | null = null;
export function stopWorkbook() { ctl?.abort(); }

/* ---------- small helpers ---------- */
function hash(s: string) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
const str = (v: unknown) => (v === undefined || v === null ? '' : String(v)).trim();
const same = (a: string, b: string) => a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim();
const SEP = '\u001f';
const joinRow = (r: string[]) => r.map(str).join(SEP);
const splitRow = (s: string) => s.split(SEP);
const low = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const isLabel = (cell: string, en: string) => bothLangs(en).some((l) => same(cell, l));

export async function xlsx() { await loadVendor('vendor/xlsx.full.min.js'); return (window as any).XLSX; }

/* ---------- the labels written in the workbook (in the app's language; read back in either) ---------- */
const L = {
  task: 'Task', due: 'Due', status: 'Status', attached: 'Attached files', id: 'Task id (do not change)',
  summary: 'Summary of the task and its files', files: 'File summaries', file: 'File', fileSummary: 'Summary',
  materials: 'Materials and conditions to prepare', notes: 'Your notes for the assistant (it follows them at the next update)',
};
const MAT_HEAD = ['#', 'Item', 'Kind', 'Quantity / details', 'Where to get it', 'Ready? (Yes/No)', 'Notes'];
const PROG_HEAD = ['#', 'Task', 'Due', 'Status', 'Progress %', 'Prepared', 'Next step', 'Files', 'Tab', 'Your comments', 'Task id'];
const SECTION_LABELS = [L.summary, L.files, L.materials, L.notes];

/* ---------- which tasks go in ---------- */
/** Open tasks up to two months ahead (late ones too), and finished ones from the last 30 days. */
export function pickTasks(): Task[] {
  const ahead = iso(addDays(todayDate(), 60)), back = iso(addDays(todayDate(), -30));
  const open = app.S.tasks.filter((x) => !x.done && x.date <= ahead).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const done = app.S.tasks.filter((x) => x.done && x.date >= back && x.date <= ahead).sort((a, b) => (a.date > b.date ? -1 : 1));
  return [...open, ...done].slice(0, MAX_TASKS).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || '99') < (b.time || '99') ? -1 : 1));
}
const taskFp = (x: Task) => hash([x.text, x.date, x.time, filesOf(x).map((f) => f.id).join(',')].join('|'));
const statusOf = (x: Task) => t(x.done ? 'Done' : x.date < todayIso() ? 'Late' : 'Open');
const dueText = (x: Task) => x.date + (x.time ? ' ' + x.time : '');
const READY = /^(y|yes|ok|done|ready|true|1|x|✓|✔|да|готов|evet|hazır|tamam)/i;

/* ---------- reading the workbook back ---------- */
interface Tab { summary: string; files: [string, string][]; rows: string[][]; notes: string }
interface Prog { progress: string; next: string; comments: string }
interface Current { tabs: Map<string, Tab>; progress: Map<string, Prog> }

const aoaOf = (X: any, ws: any): string[][] => (X.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: true }) as unknown[][]).map((r) => r.map(str));

function parseTab(rows: string[][]): { id: string; tab: Tab } | null {
  const idRow = rows.find((r) => isLabel(r[0] || '', L.id));
  const id = idRow ? str(idRow[1]) : '';
  if (!id) return null;
  const at = (en: string) => rows.findIndex((r) => isLabel(r[0] || '', en));
  const isSection = (r: string[]) => SECTION_LABELS.some((l) => isLabel(r[0] || '', l));
  const block = (en: string, skipHeader: boolean) => {
    const i = at(en); if (i < 0) return [] as string[][];
    const out: string[][] = [];
    for (let k = i + 1 + (skipHeader ? 1 : 0); k < rows.length && !isSection(rows[k]); k++) out.push(rows[k]);
    return out;
  };
  const text = (en: string) => block(en, false).map((r) => r.filter(Boolean).join(' ')).filter(Boolean).join('\n');
  const files = block(L.files, true).filter((r) => r[0]).map((r) => [r[0], r.slice(1).filter(Boolean).join(' ')] as [string, string]);
  const rowsM = block(L.materials, true).map((r) => [1, 2, 3, 4, 5, 6].map((c) => str(r[c]))).filter((r) => r.some(Boolean));
  return { id, tab: { summary: text(L.summary), files, rows: rowsM, notes: text(L.notes) } };
}

function parseProgress(rows: string[][]): Map<string, Prog> {
  const m = new Map<string, Prog>();
  const h = rows.findIndex((r) => r.some((c) => isLabel(c, 'Task id')));
  if (h < 0) return m;
  const col = (en: string) => rows[h].findIndex((c) => isLabel(c, en));
  const ci = col('Task id'), cp = col('Progress %'), cn = col('Next step'), cc = col('Your comments');
  for (const r of rows.slice(h + 1)) {
    const id = str(r[ci]); if (!id) continue;
    m.set(id, { progress: cp >= 0 ? str(r[cp]) : '', next: cn >= 0 ? str(r[cn]) : '', comments: cc >= 0 ? str(r[cc]) : '' });
  }
  return m;
}

/** Reads a workbook file. Returns null when it is not a Dayline task workbook. */
export async function readWorkbook(blob: Blob): Promise<Current | null> {
  const X = await xlsx();
  const wb = X.read(new Uint8Array(await blob.arrayBuffer()), { type: 'array' });
  const cur: Current = { tabs: new Map(), progress: new Map() };
  for (const name of wb.SheetNames) {
    const rows = aoaOf(X, wb.Sheets[name]);
    const p = parseTab(rows);
    if (p) cur.tabs.set(p.id, p.tab);
    else if (!cur.progress.size) cur.progress = parseProgress(rows);
  }
  return cur.tabs.size || cur.progress.size ? cur : null;
}

/* ---------- the user's edits: whatever differs from what the assistant wrote ---------- */
interface Edits { summary: string; files: [string, string][]; rows: string[][]; removed: string[]; next: string; notes: string }

function editsOf(m: WorkbookTaskMeta | undefined, tab: Tab | undefined, prog: Prog | undefined): Edits {
  const e: Edits = { summary: '', files: [], rows: [], removed: [], next: '', notes: tab?.notes || '' };
  if (!tab) return e;
  const ai = m?.ai;
  if (tab.summary && !(ai && same(tab.summary, ai.summary))) e.summary = tab.summary;
  for (const [n, s] of tab.files) {
    const a = ai?.files.find((f) => same(f.name, n));
    if (s && !(a && same(a.text, s))) e.files.push([n, s]);
  }
  const aiRows = (ai?.rows || []).map(splitRow);
  const key = (r: string[]) => low(r.join(' | '));
  const aiKeys = new Set(aiRows.map(key));
  e.rows = tab.rows.filter((r) => !aiKeys.has(key(r)));            // rows the user wrote or changed
  const curKeys = new Set(tab.rows.map(key)), userItems = new Set(e.rows.map((r) => low(r[0])));
  // An assistant row that is gone, and not just changed (its item is not in a row the user changed): deleted.
  e.removed = aiRows.filter((r) => !curKeys.has(key(r)) && !userItems.has(low(r[0])) && r[0]).map((r) => r[0]);
  if (prog?.next && !(ai && same(prog.next, ai.next))) e.next = prog.next;
  return e;
}
const editsFp = (e: Edits) => hash(JSON.stringify([e.summary, e.files, e.rows, e.next, e.notes]));

/* ---------- reading attached files for the assistant ---------- */
const MAX_TEXT = 20000, MAX_INLINE = 4 * 1024 * 1024;
const extOf = (n: string) => (n.split('.').pop() || '').toLowerCase();

async function filePart(f: FileRef): Promise<AiPart[]> {
  const head = (s: string) => ({ text: `\n--- Attached file "${f.name}" ---\n${s}` });
  const rec = await getFile(f.id);
  if (!rec) return [head('(This file is not on this device yet, so it could not be read.)')];
  const e = extOf(f.name), type = rec.type || f.type || '';
  const cut = (s: string) => (s.length > MAX_TEXT ? s.slice(0, MAX_TEXT) + '\n(… the rest of the file was left out)' : s);
  try {
    if (isImage(f)) {
      if (rec.size > MAX_INLINE) return [head('(A photo too big to send.)')];
      return [head('(a photo, below)'), { inlineData: { mimeType: /^image\/(png|jpeg|webp|heic|heif)$/.test(type) ? type : 'image/jpeg', data: await blobToB64(rec.blob) } }];
    }
    if (e === 'pdf' || type === 'application/pdf') {
      await loadVendor('vendor/pdf.min.js');
      const pdfjs = (window as any).pdfjsLib;
      pdfjs.GlobalWorkerOptions.workerSrc = asset('vendor/pdf.worker.min.js');
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await rec.blob.arrayBuffer()) }).promise;
      let text = '';
      for (let i = 1; i <= Math.min(doc.numPages, 40) && text.length < MAX_TEXT; i++) {
        const c = await (await doc.getPage(i)).getTextContent();
        text += c.items.map((it: any) => it.str).join(' ') + '\n';
      }
      // A scanned PDF has (almost) no text: send the PDF itself, Gemini can read it.
      if (text.replace(/\s/g, '').length < 200 && rec.size <= MAX_INLINE) return [head('(a scanned PDF, below)'), { inlineData: { mimeType: 'application/pdf', data: await blobToB64(rec.blob) } }];
      return [head(cut(text))];
    }
    if (e === 'docx') {
      await loadVendor('vendor/mammoth.browser.min.js');
      const r = await (window as any).mammoth.extractRawText({ arrayBuffer: await rec.blob.arrayBuffer() });
      return [head(cut(r.value || ''))];
    }
    if (['xlsx', 'xls', 'xlsm', 'csv', 'ods'].includes(e)) {
      const X = await xlsx();
      const wb = X.read(new Uint8Array(await rec.blob.arrayBuffer()), { type: 'array' });
      return [head(cut(wb.SheetNames.map((n: string) => `[Sheet ${n}]\n` + X.utils.sheet_to_csv(wb.Sheets[n])).join('\n')))];
    }
    if (e === 'txt' || e === 'md' || type.startsWith('text/')) return [head(cut(await rec.blob.text()))];
  } catch { return [head('(Dayline could not read this file.)')]; }
  return [head(`(A ${e.toUpperCase() || 'file'} file. Dayline cannot read this kind of file; use its name only.)`)];
}

/* ---------- asking the assistant ---------- */
interface AiTask { summary: string; files: [string, string][]; rows: string[][]; next: string }

const INSTRUCTIONS = `You prepare a planning workbook for the user's tasks, inside their personal planner app.
For each task you get: its text, due date, status, the content of its attached files (if any), and the user's own corrections.
For each task, return:
- "summary": 2 to 5 sentences: what has to be done (the task's specification), using the task text and its attached files.
- "files": for each attached file, {"name": exact file name, "summary": 2 to 4 sentences on what the file contains and what matters in it for the task}.
- "materials": the materials, tools, documents, people, permits and conditions that must be prepared to carry out the task. Each one {"item": short name, "kind": one of Material, Tool, Document, Person, Permit, Condition, Other, "detail": quantity, size or specification, "source": where to get it or who provides it}. Be concrete; take quantities and specifications from the files when they are there. 3 to 15 items; for a simple personal task a few are enough.
- "next": one short, concrete next step.
The user's corrections are always right. They come from the user's own edits of the workbook:
- If the user wrote their own summary, file summary or next step, build on it and do not contradict it.
- Rows the user wrote or corrected are already in the list: do not repeat them and do not suggest anything that contradicts them.
- Never suggest an item the user removed.
- Follow the user's notes for the assistant.
Write in the language the task is written in. Plain text, no Markdown.
Reply with JSON only: {"tasks":[{"id":"T1","summary":"…","files":[…],"materials":[…],"next":"…"}]}`;

async function askGroup(group: { x: Task; e: Edits }[], signal: AbortSignal): Promise<Map<string, AiTask>> {
  const parts: AiPart[] = [];
  const T = todayIso();
  let intro = `Today is ${T}.\n`;
  group.forEach(({ x, e }, i) => {
    const fl = filesOf(x);
    intro += `\nTask T${i + 1}: "${x.text}"\nDue: ${dueText(x)}${!x.done && x.date < T ? ' (late)' : ''}. Status: ${x.done ? 'done' : 'open'}.\n`
      + `Attached files: ${fl.length ? fl.map((f) => `"${f.name}"`).join(', ') + ' (their content follows below)' : 'none'}\n`;
    const c: string[] = [];
    if (e.summary) c.push(`The user's own summary: ${e.summary}`);
    for (const [n, s] of e.files) c.push(`The user's summary of "${n}": ${s}`);
    if (e.rows.length) c.push('Rows the user wrote or corrected (item | kind | details | source | ready | notes):\n' + e.rows.map((r) => '  ' + r.join(' | ')).join('\n'));
    if (e.removed.length) c.push(`Items the user removed (never suggest them): ${e.removed.join('; ')}`);
    if (e.next) c.push(`The user's next step: ${e.next}`);
    if (e.notes) c.push(`The user's notes for the assistant: ${e.notes}`);
    if (c.length) intro += 'User corrections:\n' + c.map((s) => '- ' + s).join('\n') + '\n';
  });
  parts.push({ text: intro });
  for (let i = 0; i < group.length; i++) {
    const fl = filesOf(group[i].x);
    if (fl.length) parts.push({ text: `\n=== Files of task T${i + 1} ===` });
    for (const f of fl) parts.push(...(await filePart(f)));
  }
  const o: any = await askAiJson(INSTRUCTIONS, parts, signal);
  const out = new Map<string, AiTask>();
  for (const r of Array.isArray(o?.tasks) ? o.tasks : Array.isArray(o) ? o : []) {
    const k = Number(String(r?.id || '').replace(/\D/g, '')) - 1;
    const g = group[k]; if (!g) continue;
    out.set(g.x.id, {
      summary: str(r.summary),
      files: (Array.isArray(r.files) ? r.files : []).map((f: any) => [str(f?.name), str(f?.summary)] as [string, string]).filter((f: [string, string]) => f[0]),
      rows: (Array.isArray(r.materials) ? r.materials : []).map((m: any) => [str(m?.item), str(m?.kind), str(m?.detail), str(m?.source), '', '']).filter((m: string[]) => m[0]),
      next: str(r.next),
    });
  }
  return out;
}

/* ---------- writing the workbook ---------- */
function sheetName(x: Task, i: number, used: Set<string>) {
  const base = `${i + 1}. ${x.text}`.replace(/[\\/?*[\]:']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 28).trim();
  let n = base, k = 2;
  while (used.has(low(n))) n = base.slice(0, 25) + ' ' + k++;
  used.add(low(n));
  return n;
}

function taskSheet(X: any, x: Task, tab: Tab) {
  const fl = filesOf(x);
  const aoa: (string | number)[][] = [
    [t(L.task), x.text], [t(L.due), dueText(x)], [t(L.status), statusOf(x)],
    [t(L.attached), fl.map((f) => f.name).join(', ') || t('none')], [t(L.id), x.id], [],
    [t(L.summary)], [tab.summary], [],
    [t(L.files)], [t(L.file), t(L.fileSummary)],
  ];
  const merges: any[] = [{ s: { r: 0, c: 1 }, e: { r: 0, c: 6 } }, { s: { r: 7, c: 0 }, e: { r: 7, c: 6 } }];
  const files = fl.map((f) => tab.files.find(([n]) => same(n, f.name)) || [f.name, '']);
  for (const [n, s] of files) { merges.push({ s: { r: aoa.length, c: 1 }, e: { r: aoa.length, c: 6 } }); aoa.push([n, s]); }
  if (!files.length) aoa.push([t('(no files attached)')]);
  aoa.push([], [t(L.materials)], MAT_HEAD.map((h) => t(h)));
  tab.rows.forEach((r, i) => aoa.push([i + 1, ...r]));
  aoa.push([tab.rows.length + 1], [tab.rows.length + 2]); // empty rows to add your own
  aoa.push([], [t(L.notes)]);
  merges.push({ s: { r: aoa.length, c: 0 }, e: { r: aoa.length, c: 6 } });
  aoa.push([tab.notes]);
  const ws = X.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 26 }, { wch: 34 }, { wch: 13 }, { wch: 26 }, { wch: 24 }, { wch: 14 }, { wch: 28 }];
  ws['!merges'] = merges;
  return ws;
}

function progressSheet(X: any, list: { x: Task; tab: Tab; prog: string; next: string; comments: string; name: string }[]) {
  const aoa: (string | number)[][] = [
    [t('Task progress')],
    [t('Updated {when}. The assistant updates this workbook every day at {h}:00 (when Dayline is open).', { when: fmt(new Date(), { day: 'numeric', month: 'long', year: 'numeric' }) + ' ' + new Date().toTimeString().slice(0, 5), h: UPDATE_HOUR })],
    [], PROG_HEAD.map((h) => t(h)),
  ];
  list.forEach(({ x, tab, prog, next, comments, name }, i) => {
    const ready = tab.rows.filter((r) => READY.test(r[4] || '')).length;
    aoa.push([i + 1, x.text, dueText(x), statusOf(x), x.done ? '100%' : prog || '0%', tab.rows.length ? t('{a} of {b} ready', { a: ready, b: tab.rows.length }) : '',
      next, filesOf(x).map((f) => f.name).join(', '), name, comments, x.id]);
  });
  const ws = X.utils.aoa_to_sheet(aoa);
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } }];
  ws['!cols'] = [{ wch: 4 }, { wch: 34 }, { wch: 16 }, { wch: 9 }, { wch: 11 }, { wch: 12 }, { wch: 40 }, { wch: 26 }, { wch: 20 }, { wch: 30 }, { wch: 14 }];
  return ws;
}

/** Saves a new copy of the workbook file on the note (the old copy is removed). */
export async function storeWorkbookFile(note: Note, blob: Blob) {
  const id = uid(), old = filesOf(note);
  await idbSet('file:' + id, { name: FILE_NAME, type: XLSX_TYPE, size: blob.size, blob });
  note.files = [{ id, name: FILE_NAME, type: XLSX_TYPE, size: blob.size }];
  note.updated = Date.now();
  for (const f of old) await idbDel('file:' + f.id);
}

export async function workbookBlob(): Promise<Blob | null> {
  const n = workbookNote(), f = n && filesOf(n)[0];
  if (!f) return null;
  return (await getFile(f.id))?.blob || null;
}

/** Deletes the workbook and its file. */
export async function deleteWorkbook() {
  stopWorkbook();
  const note = workbookNote(); if (!note) return;
  for (const f of filesOf(note)) await idbDel('file:' + f.id);
  app.S.notes = app.S.notes.filter((n) => n.id !== note.id);
  await save();
}

/** "Next update: today 20:00." */
export function nextUpdateText(note: Note) {
  return t('Next update: {when}.', { when: dayText(nextSlot(new Date(Math.max(Date.now(), note.wb?.last || 0)))) });
}

/* ---------- the update ---------- */
/** Makes the workbook (the first time) or brings it up to date. Returns false when it did not finish. */
export async function updateWorkbook(): Promise<boolean> {
  if (wbStatus.running) return false;
  if (!aiEnabled()) { wbStatus.error = t('Add your Gemini key in Settings first.'); emit(); return false; }
  Object.assign(wbStatus, { running: true, done: 0, total: 0, error: '' }); emit();
  const my = new AbortController(); ctl = my;
  try {
    const X = await xlsx();
    let note = workbookNote();
    const meta: WorkbookMeta = note?.wb ? JSON.parse(JSON.stringify(note.wb)) : { last: 0, tasks: {} };
    let cur: Current = { tabs: new Map(), progress: new Map() };
    if (note && filesOf(note).length) {
      const blob = await workbookBlob();
      if (!blob) throw new AiError('The workbook has not reached this device yet. Try again in a moment.');
      cur = (await readWorkbook(blob)) || cur;
    }

    const tasks = pickTasks();
    // Which tasks need the assistant: new ones, changed ones, and ones whose tab the user edited.
    const work: { x: Task; e: Edits }[] = [];
    const editsBy = new Map<string, Edits>();
    for (const x of tasks) {
      const m = meta.tasks[x.id], tab = cur.tabs.get(x.id), e = editsOf(m, tab, cur.progress.get(x.id));
      e.removed = [...new Set([...(m?.removed || []), ...e.removed])];
      editsBy.set(x.id, e);
      if (!m || !tab || m.fp !== taskFp(x) || m.user !== editsFp(e)) work.push({ x, e });
    }
    // Tasks with files go one by one (files can be long); others go up to 8 at a time.
    const groups: { x: Task; e: Edits }[][] = [];
    let small: { x: Task; e: Edits }[] = [];
    for (const w of work) {
      if (filesOf(w.x).length) groups.push([w]);
      else { small.push(w); if (small.length === 8) { groups.push(small); small = []; } }
    }
    if (small.length) groups.push(small);
    wbStatus.total = work.length; emit();

    const fresh = new Map<string, AiTask>(), asked = new Set(work.map((w) => w.x.id));
    for (const g of groups) {
      const got = await askGroup(g, my.signal);
      got.forEach((v, k) => fresh.set(k, v));
      wbStatus.done += g.length; emit();
    }

    // Put it together. The user's text always stays; the assistant's text is replaced by its new answer.
    const XW = X.utils.book_new(), used = new Set<string>([low(t('Progress'))]);
    const list: Parameters<typeof progressSheet>[1] = [];
    const tabs: [string, any][] = [];
    const nextMeta: WorkbookMeta = { last: Date.now(), tasks: {} };
    tasks.forEach((x, i) => {
      const e = editsBy.get(x.id)!, old = meta.tasks[x.id], tab0 = cur.tabs.get(x.id), prog = cur.progress.get(x.id);
      const a = fresh.get(x.id);
      let tab: Tab, ai: WorkbookTaskMeta['ai'];
      if (a) {
        const removed = new Set(e.removed.map(low)), mine = new Set(e.rows.map((r) => low(r[0])));
        const aiRows = a.rows.filter((r) => !removed.has(low(r[0])) && !mine.has(low(r[0])));
        const files = filesOf(x).map((f) => {
          const u = e.files.find(([n]) => same(n, f.name)), g = a.files.find(([n]) => same(n, f.name));
          return [f.name, u ? u[1] : g ? g[1] : ''] as [string, string];
        });
        tab = { summary: e.summary || a.summary, files, rows: [...e.rows, ...aiRows], notes: e.notes };
        ai = { summary: a.summary, files: a.files.map(([name, text]) => ({ name, text })), rows: aiRows.map(joinRow), next: a.next };
      } else if (old && tab0) {
        tab = tab0; ai = old.ai;   // nothing changed: keep the tab exactly as it is
      } else {
        // The assistant did not answer for this task (rare): keep what is there and try again next time.
        tab = tab0 || { summary: '', files: [], rows: [], notes: '' };
        ai = old?.ai || { summary: '', files: [], rows: [], next: '' };
      }
      const next = e.next || (a ? a.next : prog?.next || old?.ai.next || '');
      const name = sheetName(x, i, used);
      tabs.push([name, taskSheet(X, x, tab)]);
      list.push({ x, tab, prog: prog?.progress || '', next, comments: prog?.comments || '', name });
      const doneNow = !!a || (!!old && !!tab0 && !asked.has(x.id));
      nextMeta.tasks[x.id] = { fp: doneNow ? taskFp(x) : '', user: doneNow ? editsFp(e) : '', ai, removed: e.removed };
    });
    X.utils.book_append_sheet(XW, progressSheet(X, list), t('Progress'));
    for (const [n, ws] of tabs) X.utils.book_append_sheet(XW, ws, n);
    const blob = new Blob([X.write(XW, { bookType: 'xlsx', type: 'array' })], { type: XLSX_TYPE });

    // Someone may have deleted or replaced the workbook meanwhile: use the note as it is now.
    note = workbookNote();
    if (!note) {
      note = { id: uid(), type: 'text', title: t('AI task workbook'), body: '', items: [], photo: null, locked: false, updated: Date.now(), book: 'workbook' };
      app.S.notes.push(note);
    }
    await storeWorkbookFile(note, blob);
    note.wb = nextMeta;
    note.body = t('{n} tasks', { n: tasks.length });
    await save();
    return true;
  } catch (e) {
    if (!my.signal.aborted) wbStatus.error = t(e instanceof AiError ? e.message : 'The workbook could not be updated. Try again.');
    return false;
  } finally {
    wbStatus.running = false; if (ctl === my) ctl = null; emit();
  }
}

/* ---------- every day at 20:00 ---------- */
/** The most recent 20:00 that has passed. */
export function lastSlot(now = new Date()) {
  const d = new Date(now); d.setHours(UPDATE_HOUR, 0, 0, 0);
  if (now < d) d.setDate(d.getDate() - 1);
  return d.getTime();
}
/** When the next automatic update is due. */
export function nextSlot(now = new Date()) { return lastSlot(now) + 864e5; }

let lastTry = 0;
function tick() {
  const note = workbookNote();
  if (!note || !aiEnabled() || wbStatus.running || !navigator.onLine) return;
  if ((note.wb?.last || 0) >= lastSlot()) return;
  if (Date.now() - lastTry < 30 * 60000) return; // after a failure, wait half an hour before trying again
  lastTry = Date.now();
  updateWorkbook().then((ok) => { if (ok) lastTry = 0; });
}
let clock = false;
/** Called once at start-up: checks every minute, and whenever the app comes back to the screen. */
export function startWorkbookClock() {
  if (clock) return; clock = true;
  setTimeout(tick, 5000);
  setInterval(tick, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(tick, 3000); });
}

export const dayText = (ts: number) => {
  const d = new Date(ts), k = iso(d);
  const day = k === todayIso() ? t('today') : k === iso(addDays(todayDate(), 1)) ? t('tomorrow') : k === iso(addDays(todayDate(), -1)) ? t('yesterday') : fmt(fromIso(k), { day: 'numeric', month: 'short' });
  return `${day} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
