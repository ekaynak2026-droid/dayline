// The Helper tab's thinking, done entirely on the phone (no internet, nothing is sent anywhere).
//
// For each open task it guesses what kind of job it is from its words (a call, a bill, shopping…),
// then suggests first steps, a rough effort, and a free time slot that fits around the day's events
// and timed tasks. Similar jobs due close together are suggested as one batch.

import type { Task } from '@/types';
import { app } from './store';
import { addDays, byTime, cap, fmt, fromIso, iso, pad, todayDate, todayIso } from './dates';
import { t } from './i18n';

export type Kind = 'call' | 'pay' | 'buy' | 'book' | 'write' | 'papers' | 'home' | 'car' | 'health' | 'focus' | 'other';

interface KindInfo { re: RegExp; mins: number; steps: string[]; tip: string; batch?: string }

// Checked in this order; the first match wins. English and Russian words.
const KINDS: [Kind, KindInfo][] = [
  ['call', { re: /\b(call|phone|ring)\b|позвон|звон|созвон/, mins: 10, batch: 'Make your {n} calls in one go',
    steps: ['Find the number and note what to ask', 'Pick a quiet 10 minutes', 'Make the call and write down the answer'],
    tip: 'Calling just after they open usually means less waiting.' }],
  ['pay', { re: /\b(pay|bill|invoice|rent|tax|fee|fine)\b|оплат|счёт|счет|налог|квартплат|штраф/, mins: 10, batch: 'Pay your {n} bills in one sitting',
    steps: ['Find the bill or account number', 'Check the amount and due date', 'Pay in your banking app', 'Attach the receipt to this task'],
    tip: 'Use the folder button on the task to keep the receipt with it.' }],
  ['book', { re: /\b(book|reserve|reservation|appointment|table)\b|заброн|запис|бронь|столик/, mins: 15,
    steps: ['Check your calendar for 2–3 dates that suit you', 'Book online or contact them', 'Add the confirmed time as an event', 'Set a reminder the day before'],
    tip: 'Booking a few days ahead usually gives you more choice.' }],
  ['papers', { re: /\b(renew|insurance|passport|visa|licen[cs]e|document|form|contract|apply|application|certificate)\b|продл|страхов|паспорт|документ|договор|заявлен|виза|справк/, mins: 40,
    steps: ['Gather the documents and numbers you need', 'Check the terms or compare two options', 'Fill in the form or call the provider', 'Save the confirmation in this task'],
    tip: 'Check the expiry or deadline date first: it tells you how urgent this is.' }],
  ['write', { re: /\b(e-?mail|mail|write|send|reply|message|letter|text)\b|написат|письм|отправ|ответит|сообщен/, mins: 15, batch: 'Answer your {n} messages in one go',
    steps: ['Jot down the 2–3 points to say', 'Write a short draft', 'Read it once, then send'],
    tip: 'A short message sent today beats a perfect one sent next week.' }],
  ['buy', { re: /\b(buy|shop|shopping|order|purchase|present|gift|pick up|collect|dry clean\w*|groceries)\b|купит|заказат|подар|магазин|забрать|продукт/, mins: 20, batch: 'Do your {n} errands on one trip',
    steps: ['Decide exactly what you need', 'Check where to get it and the price', 'Order online or add it to one trip'],
    tip: 'Combine it with other errands near the same place.' }],
  ['car', { re: /\b(car|garage|tyres?|tires?|mot|mechanic)\b|машин|автосерв|шин|гараж/, mins: 60,
    steps: ['Check the address and opening times', 'Take the documents and keys', 'Plan how you will get back'],
    tip: 'Ask for a price before they start the work.' }],
  ['health', { re: /\b(doctor|dentist|clinic|hospital|pharmacy|gym|run|workout|yoga)\b|врач|стомат|клиник|аптек|трениров|спорт/, mins: 60,
    steps: ['Check the time and address', 'Note your questions or what to bring', 'Leave 10 minutes early'],
    tip: 'Write your questions down before you go, so you don’t forget them.' }],
  ['home', { re: /\b(fix|repair|clean|wash|tidy|plumber|electrician|sink|laundry|water|plants?|garden|cook)\b|почин|ремонт|убра|убор|помыт|стирк|сантехник|полить|цвет/, mins: 30,
    steps: ['Get what you need ready (tools, products)', 'Start with the smallest part', 'Finish and put things away'],
    tip: 'Put on a 25-minute timer: most home jobs are done before it rings.' }],
  ['focus', { re: /\b(study|read|learn|prepare|report|presentation|review|plan|draft|project|homework|exam|design|model|drawing)\b|подготов|отчёт|отчет|презентац|учит|прочит|проект|экзамен|чертёж|чертеж/, mins: 60,
    steps: ['Decide what “done” looks like for today', 'Work 25 minutes with your phone away', 'Take 5 minutes off, then one more round', 'Write down where you stopped'],
    tip: 'Do this in your freshest hours, before the small jobs.' }],
];
const OTHER: KindInfo = { re: /$^/, mins: 25,
  steps: ['Write down the very first small action', 'Set a 25-minute timer and start', 'Tick it off, or note what is left'],
  tip: 'If the first step takes under 2 minutes, do it right now.' };

export function kindOf(text: string): [Kind, KindInfo] {
  const s = text.toLowerCase();
  for (const k of KINDS) if (k[1].re.test(s)) return k;
  return ['other', OTHER];
}

const toMin = (hm: string) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
const toHm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const DAY_START = 9 * 60, DAY_END = 21 * 60;

/** Busy minutes on a day: events with a time (1 hour) and timed tasks (30 minutes). */
function busyOn(k: string): [number, number][] {
  const b: [number, number][] = [];
  app.S.events.filter((e) => e.date === k && e.time).forEach((e) => { const s = toMin(e.time); b.push([s, s + 60]); });
  app.S.tasks.filter((x) => x.date === k && x.time && !x.done).forEach((x) => { const s = toMin(x.time); b.push([s, s + 30]); });
  return b;
}

/** First free start time on day k for `mins`, avoiding busy times and slots already suggested. */
function freeSlot(k: string, mins: number, taken: Map<string, [number, number][]>): number | null {
  const busy = [...busyOn(k), ...(taken.get(k) || [])].sort((a, b) => a[0] - b[0]);
  let start = DAY_START;
  if (k === todayIso()) { const n = new Date(); start = Math.max(start, Math.ceil((n.getHours() * 60 + n.getMinutes() + 10) / 15) * 15); }
  for (const [s, e] of busy) {
    if (start + mins <= s) break;
    if (e > start) start = Math.ceil(e / 15) * 15;
  }
  if (start + mins > DAY_END) return null;
  taken.set(k, [...(taken.get(k) || []), [start, start + mins + 10]]);
  return start;
}

/** Free stretches of 30 minutes or more left today, e.g. "14:00–16:00". */
export function freeToday(): string[] {
  const k = todayIso(), n = new Date();
  let start = Math.max(DAY_START, Math.ceil((n.getHours() * 60 + n.getMinutes()) / 15) * 15);
  const out: string[] = [];
  for (const [s, e] of busyOn(k).sort((a, b) => a[0] - b[0])) {
    if (s - start >= 30) out.push(`${toHm(start)}–${toHm(s)}`);
    start = Math.max(start, e);
  }
  if (DAY_END - start >= 30) out.push(`${toHm(start)}–${toHm(DAY_END)}`);
  return out.slice(0, 3);
}

export type Urgency = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later';
export interface Advice {
  task: Task;
  kind: Kind;
  urgency: Urgency;
  daysLate: number;
  mins: number;
  steps: string[];
  tip: string;
  /** Suggested day and time, or null when that day is full. */
  slot: { date: string; time: string } | null;
}

const dayDiff = (k: string) => Math.round((fromIso(k).getTime() - todayDate().getTime()) / 864e5);
const urgencyOf = (k: string): Urgency => { const d = dayDiff(k); return d < 0 ? 'overdue' : d === 0 ? 'today' : d === 1 ? 'tomorrow' : d <= 7 ? 'week' : 'later'; };

/** Open tasks from the past and the next two weeks, most urgent first, with advice for each. */
export function adviseAll(limit = 15): Advice[] {
  const T = todayIso(), last = iso(addDays(todayDate(), 14));
  const open = app.S.tasks.filter((x) => !x.done && x.date <= last)
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : byTime(a, b))
    .slice(0, limit);
  const taken = new Map<string, [number, number][]>();
  // Big jobs get the first free slots, so place them before the small ones.
  const order = [...open].sort((a, b) => kindOf(b.text)[1].mins - kindOf(a.text)[1].mins);
  const slots = new Map<string, Advice['slot']>();
  for (const x of order) {
    const info = kindOf(x.text)[1];
    if (x.time && x.date >= T) { slots.set(x.id, { date: x.date, time: x.time }); continue; }
    const k = x.date < T ? T : x.date;
    let s = freeSlot(k, info.mins, taken), day = k;
    if (s === null && k === T) { day = iso(addDays(todayDate(), 1)); s = freeSlot(day, info.mins, taken); }
    slots.set(x.id, s === null ? null : { date: day, time: toHm(s) });
  }
  return open.map((x) => {
    const [kind, info] = kindOf(x.text);
    return { task: x, kind, urgency: urgencyOf(x.date), daysLate: Math.max(0, -dayDiff(x.date)), mins: info.mins,
      steps: info.steps.map((s) => t(s)), tip: t(info.tip), slot: slots.get(x.id) ?? null };
  });
}

/** "Today 14:00", "Tomorrow 09:00", "Tuesday 10:30". */
export function slotLabel(s: { date: string; time: string }) {
  const d = dayDiff(s.date);
  const day = d === 0 ? t('Today') : d === 1 ? t('Tomorrow') : cap(fmt(fromIso(s.date), { weekday: 'long' }));
  return `${day} ${s.time}`;
}

export const effortLabel = (m: number) => m < 60 ? t('about {n} min', { n: m }) : t('about {n} h', { n: Math.round(m / 60) });

/** Similar small jobs due within the next 7 days (or overdue), suggested as one batch. */
export function batches(list: Advice[]): { text: string; ids: string[] }[] {
  const out: { text: string; ids: string[] }[] = [];
  for (const [kind, info] of KINDS) {
    if (!info.batch) continue;
    const g = list.filter((a) => a.kind === kind && a.urgency !== 'later');
    if (g.length >= 2) out.push({ text: t(info.batch, { n: g.length }) + ': ' + g.map((a) => `“${a.task.text}”`).join(', '), ids: g.map((a) => a.task.id) });
  }
  return out;
}

/** One or two sentences: where to start. */
export function focusLine(list: Advice[]): string {
  if (!list.length) return t('Nothing open for the next two weeks. Enjoy the free time, or add something on the Tasks tab.');
  const late = list.filter((a) => a.urgency === 'overdue');
  const today = list.filter((a) => a.urgency === 'today');
  if (late.length) {
    const first = [...late].sort((a, b) => a.mins - b.mins)[0];
    const v = { n: late.length, task: first.task.text, effort: effortLabel(first.mins) };
    return late.length === 1 ? t('1 task is overdue. Start with “{task}”: it takes {effort}.', v) : t('{n} tasks are overdue. Start with “{task}”: it takes {effort}, and clearing it gets things moving.', v);
  }
  if (today.length) {
    const total = today.reduce((s, a) => s + a.mins, 0);
    const timed = today.filter((a) => a.task.time).sort((a, b) => byTime(a.task, b.task))[0];
    const first = timed || [...today].sort((a, b) => b.mins - a.mins)[0];
    const v = { n: today.length, effort: effortLabel(total), task: first.task.text };
    return today.length === 1 ? t('Today has 1 open task, {effort} of work: “{task}”.', v) : t('Today has {n} open tasks, {effort} of work. Start with “{task}”.', v);
  }
  const next = list[0];
  return t('Nothing due today. Next up: “{task}”, {when}.', { task: next.task.text, when: next.urgency === 'tomorrow' ? t('tomorrow') : cap(fmt(fromIso(next.task.date), { weekday: 'long', day: 'numeric', month: 'long' })) });
}
