'use client';
// The Mission skill of the AI assistant.
//
// Write a keyword in a task — Mis.A, Mis.B, Mis.C (small or capital letters) — and the assistant does
// that kind of duty for the task:
//   Mis.A  takes the sentence as a command and tries to carry it out (it may add tasks, events and notes),
//   Mis.B  prepares the questions that must be answered before the task can be done,
//   Mis.C  prepares a conclusion report about the task.
// What each keyword means is written in plain words in public/skills/mission.md (the skill file). The app
// reads that file, so the skill can be revised there without changing any code; a new "## Mis.D" section
// in it becomes a new keyword. Only the answer format below is fixed here, so the app can read the answer.
//
// The result of each mission is saved as a note ("Mis.A · <task>"). Missions run while Dayline is open,
// when a task with a keyword is new or its text or files change, or when "Run again" is tapped.

import type { Note, Task } from '@/types';
import { app, emit, save } from './store';
import { filesOf } from './files';
import { AiError, MODEL, aiEnabled, askAiJson, type AiPart } from './ai';
import { filePart } from './workbook';
import { asset } from './config';
import { todayIso, uid } from './dates';
import { t } from './i18n';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface MissionKind { key: string; title: string; text: string }
export interface Skill { general: string; kinds: MissionKind[] }

const CACHE = 'dayline-skill-mission';
const DEFAULT_KEYS: MissionKind[] = [
  { key: 'A', title: 'Carry out the command', text: 'Take the sentence in the task as a command and try to carry it out.' },
  { key: 'B', title: 'Ask the questions needed', text: 'Prepare the questions that must be answered before the task can be carried out.' },
  { key: 'C', title: 'Conclusion report', text: 'Prepare a conclusion report about the task.' },
];

/** Splits the skill file into its general part and one section per keyword ("## Mis.A — title"). */
export function parseSkill(md: string): Skill {
  const parts = md.split(/^##\s+/m);
  const kinds: MissionKind[] = [];
  for (const p of parts.slice(1)) {
    const m = /^mis\.\s?([a-z])\b\s*[—–:-]?\s*(.*)$/im.exec(p.split('\n')[0]);
    if (!m) continue;
    kinds.push({ key: m[1].toUpperCase(), title: m[2].trim(), text: p.split('\n').slice(1).join('\n').trim() });
  }
  return { general: parts[0].trim(), kinds: kinds.length ? kinds : DEFAULT_KEYS };
}

let skill: Skill | null = null;
const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
/** The skill as known right now (the copy read last time, until the file has been read again). */
export function currentSkill(): Skill {
  if (!skill) { const c = lsGet(CACHE); skill = c ? parseSkill(c) : { general: '', kinds: DEFAULT_KEYS }; }
  return skill;
}
/** Reads the skill file (online when possible, so a revised skill is used at once). */
export async function loadSkill(): Promise<Skill> {
  try {
    const r = await fetch(asset('skills/mission.md'), { cache: 'no-cache' });
    if (r.ok) { const md = await r.text(); if (/^##\s+mis\./im.test(md)) { lsSet(CACHE, md); skill = parseSkill(md); emit(); } }
  } catch { /* offline: keep the copy read last time */ }
  return currentSkill();
}

/* ---------- finding keywords in tasks ---------- */
const KEYWORD = /\bmis\.\s?([a-z])\b/gi;
/** The mission keywords written in a task, e.g. ['A', 'C']. */
export function keysOf(text: string): string[] {
  const known = new Set(currentSkill().kinds.map((k) => k.key));
  return [...new Set([...text.matchAll(KEYWORD)].map((m) => m[1].toUpperCase()))].filter((k) => known.has(k));
}
/** The task text without its keywords. */
export const plainText = (text: string) => text.replace(KEYWORD, ' ').replace(/\s+/g, ' ').trim();

function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
const missionFp = (x: Task) => hash([x.text, filesOf(x).map((f) => f.id).join(',')].join('|'));
export const resultNote = (taskId: string, key: string) => app.S.notes.find((n) => n.mission?.task === taskId && n.mission.key === key) || null;

/** Tasks with a keyword, open ones first. */
export function missionTasks(): { x: Task; keys: string[] }[] {
  return app.S.tasks.map((x) => ({ x, keys: keysOf(x.text) })).filter((m) => m.keys.length)
    .sort((a, b) => (a.x.done !== b.x.done ? (a.x.done ? 1 : -1) : a.x.date < b.x.date ? -1 : 1));
}

/* ---------- status shown on screen ---------- */
export const missionStatus = { running: '' as string, errors: {} as Record<string, string> };
const id = (taskId: string, key: string) => taskId + ':' + key;

/* ---------- asking the assistant ---------- */
const FORMAT = `Reply with JSON only, in this form:
{"title": "a short title for the result",
 "report": "the result: the finished work, the explanation or the report (plain text, line breaks allowed)",
 "questions": ["questions for the user, only when the mission asks for questions"],
 "actions": [ planner actions, only when the mission allows them and they are needed:
   {"type": "task", "text": "…", "date": "YYYY-MM-DD", "time": "HH:MM or empty"},
   {"type": "event", "title": "…", "date": "YYYY-MM-DD", "time": "HH:MM or empty"},
   {"type": "note", "title": "…", "body": "…"},
   {"type": "checklist", "title": "…", "items": ["…"]} ]}
Use [] for "questions" or "actions" when there are none. At most 10 actions.`;

async function ask(x: Task, kind: MissionKind, sk: Skill, signal: AbortSignal) {
  const instructions = `You are the AI assistant inside the user's personal day planner app (Dayline), running the Mission skill.\n\n${sk.general}\n\nThe mission to do now: Mis.${kind.key} — ${kind.title}\n${kind.text}\n\n${FORMAT}`;
  const earlier = app.S.notes.filter((n) => n.mission?.task === x.id).map((n) => `[${n.title}]\n${n.body}`).join('\n\n').slice(0, 12000);
  const fl = filesOf(x);
  const parts: AiPart[] = [{
    text: `Today is ${todayIso()}.\nTask: "${plainText(x.text)}"\nDate: ${x.date}${x.time ? ' ' + x.time : ''}. Status: ${x.done ? 'done' : 'open'}.\n`
      + `Attached files: ${fl.length ? fl.map((f) => `"${f.name}"`).join(', ') + ' (content below)' : 'none'}\n`
      + (earlier ? `\nEarlier mission results for this task, with any answers the user wrote in them (the user's answers are correct):\n${earlier}\n` : ''),
  }];
  for (const f of fl) parts.push(...(await filePart(f)));
  return (await askAiJson(instructions, parts, signal)) as any;
}

/* ---------- carrying out the planner actions ---------- */
const DATE = /^\d{4}-\d{2}-\d{2}$/, TIME = /^\d{2}:\d{2}$/;
const clean = (s: unknown) => plainText(String(s ?? '')).slice(0, 500);
function apply(actions: any[], x: Task): string[] {
  const done: string[] = [];
  for (const a of (Array.isArray(actions) ? actions : []).slice(0, 10)) {
    const date = DATE.test(String(a?.date)) ? String(a.date) : x.date || todayIso();
    const time = TIME.test(String(a?.time)) ? String(a.time) : '';
    if (a?.type === 'task' && clean(a.text)) {
      app.S.tasks.push({ id: uid(), text: clean(a.text), date, time, remind: '', done: false, updated: Date.now() });
      done.push(t('Added task: {s}', { s: `${clean(a.text)} (${date}${time ? ' ' + time : ''})` }));
    } else if (a?.type === 'event' && clean(a.title)) {
      app.S.events.push({ id: uid(), title: clean(a.title), date, time, remind: '', color: 1, updated: Date.now() });
      done.push(t('Added to the calendar: {s}', { s: `${clean(a.title)} (${date}${time ? ' ' + time : ''})` }));
    } else if (a?.type === 'note' && clean(a.title)) {
      app.S.notes.push({ id: uid(), type: 'text', title: clean(a.title), body: String(a.body ?? ''), items: [], photo: null, locked: false, updated: Date.now() });
      done.push(t('Added note: {s}', { s: clean(a.title) }));
    } else if (a?.type === 'checklist' && clean(a.title)) {
      const items = (Array.isArray(a.items) ? a.items : []).map(clean).filter(Boolean).map((s: string) => ({ t: s, done: false }));
      app.S.notes.push({ id: uid(), type: 'list', title: clean(a.title), body: '', items, photo: null, locked: false, updated: Date.now() });
      done.push(t('Added checklist: {s}', { s: clean(a.title) }));
    }
  }
  return done;
}

/* ---------- running a mission ---------- */
let ctl: AbortController | null = null;
export function stopMission() { ctl?.abort(); }

/** Does one mission for one task and saves the result note. Returns false when it did not finish. */
export async function runMission(taskId: string, key: string): Promise<boolean> {
  if (missionStatus.running || !aiEnabled()) return false;
  const x = app.S.tasks.find((k) => k.id === taskId); if (!x) return false;
  const my = new AbortController(); ctl = my;
  missionStatus.running = id(taskId, key); delete missionStatus.errors[id(taskId, key)]; emit();
  try {
    const sk = await loadSkill();
    const kind = sk.kinds.find((k) => k.key === key);
    if (!kind) throw new AiError('This keyword is not in the Mission skill.');
    const o = await ask(x, kind, sk, my.signal);
    const report = String(o?.report ?? '').trim();
    const questions: string[] = (Array.isArray(o?.questions) ? o.questions : []).map((q: unknown) => String(q).trim()).filter(Boolean);
    if (!report && !questions.length) throw new AiError('The assistant did not answer in the expected way. Try again.');
    const done = apply(o?.actions, x);
    let body = report;
    if (questions.length) body += `\n\n${t('Questions (write your answer after each "Answer:", then save the note):')}\n` + questions.map((q, i) => `${i + 1}. ${q}\n${t('Answer:')} `).join('\n');
    if (done.length) body += `\n\n${t('Done in the planner:')}\n` + done.map((d) => '• ' + d).join('\n');
    body += `\n\n— ${t('Mission skill, Mis.{k}, {model}, {date}', { k: key, model: MODEL, date: new Date().toLocaleString() })}`;
    let note: Note | null = resultNote(x.id, key);
    if (!note) { note = { id: uid(), type: 'text', title: '', body: '', items: [], photo: null, locked: false, updated: 0 }; app.S.notes.push(note); }
    note.title = `Mis.${key} · ${plainText(x.text) || t('Task')}`.slice(0, 120);
    note.body = body.trim();
    note.updated = Date.now();
    note.mission = { task: x.id, key, fp: missionFp(x) };
    await save();
    return true;
  } catch (e) {
    if (!my.signal.aborted) missionStatus.errors[id(taskId, key)] = t(e instanceof AiError ? e.message : 'The assistant stopped. Try again.');
    return false;
  } finally {
    missionStatus.running = ''; if (ctl === my) ctl = null; emit();
  }
}

/** Missions waiting: open tasks with a keyword whose result is missing or older than the task. */
export function pendingMissions(): [string, string][] {
  const out: [string, string][] = [];
  for (const { x, keys } of missionTasks()) {
    if (x.done) continue;
    for (const k of keys) { const n = resultNote(x.id, k); if (!n || n.mission!.fp !== missionFp(x)) out.push([x.id, k]); }
  }
  return out;
}

/* ---------- running by itself while the app is open ---------- */
const failedAt: Record<string, number> = {};
let busy = false;
async function tick() {
  if (busy || !aiEnabled() || missionStatus.running || !navigator.onLine) return;
  busy = true;
  try {
    for (const [tid, k] of pendingMissions()) {
      if (Date.now() - (failedAt[id(tid, k)] || 0) < 30 * 60000) continue; // after a failure, wait half an hour
      if (missionStatus.running) break;
      if (!(await runMission(tid, k))) { failedAt[id(tid, k)] = Date.now(); if (!navigator.onLine) break; }
    }
  } finally { busy = false; }
}
let started = false;
export function startMissions() {
  if (started) return; started = true;
  loadSkill();
  setTimeout(tick, 8000);
  setInterval(tick, 60000);
}
