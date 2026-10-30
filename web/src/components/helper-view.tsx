'use client';
// The Helper tab: reads the open tasks and calendar on this phone and suggests where to start,
// first steps, effort and a free time slot for each task. Works offline; nothing is sent anywhere.

import React, { useState } from 'react';
import { app, save, toast, useApp } from '@/lib/store';
import { todayIso, uid } from '@/lib/dates';
import { t } from '@/lib/i18n';
import { adviseAll, batches, effortLabel, focusLine, freeToday, slotLabel, type Advice, type Urgency } from '@/lib/helper';
import { editTask } from './rows';
import { cls } from './ui';

// Tasks whose steps were already added, so the button isn't pressed twice by mistake.
const ADDED_KEY = 'dayline-helper-added';
function readAdded(): string[] { try { return JSON.parse(localStorage.getItem(ADDED_KEY) || '[]'); } catch { return []; } }
function writeAdded(ids: string[]) { try { localStorage.setItem(ADDED_KEY, JSON.stringify(ids.slice(-200))); } catch { /* private mode */ } }

const URGENCY: Record<Urgency, { label: string; cls: string }> = {
  overdue: { label: 'Overdue', cls: 'bg-[var(--sun-soft)] text-[var(--sun-ink)] border-[var(--sun)]' },
  today: { label: 'Today', cls: 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)]' },
  tomorrow: { label: 'Tomorrow', cls: 'border-[var(--line)] text-[var(--ink)]' },
  week: { label: 'This week', cls: 'border-[var(--line)] text-[var(--muted)]' },
  later: { label: 'Later', cls: 'border-[var(--line)] text-[var(--muted)]' },
};
const chip = 'inline-flex items-center border rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums';

function AdviceCard({ a, added, onAdded, onOpenDay }: { a: Advice; added: boolean; onAdded: () => void; onOpenDay: (k: string) => void }) {
  const x = a.task, T = todayIso();
  const urg = URGENCY[a.urgency];
  const slotIsCurrent = a.slot && x.date === a.slot.date && x.time === a.slot.time;

  const schedule = () => {
    if (!a.slot) return;
    x.date = a.slot.date; x.time = a.slot.time; x.updated = Date.now();
    save(); toast(t('Planned for {when}', { when: slotLabel(a.slot) }));
  };
  const addSteps = () => {
    const day = x.date < T ? T : x.date;
    a.steps.forEach((s) => app.S.tasks.push({ id: uid(), text: `${s} (${x.text})`, date: day, time: '', remind: '', done: false, updated: Date.now() }));
    save(); onAdded(); toast(t('Added {n} steps to your list', { n: a.steps.length }));
  };

  return (
    <article className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-3.5 grid gap-2 min-w-0">
      <h3 className="m-0 font-display font-semibold text-[17px] leading-snug text-[var(--ink)] break-words">{x.text}</h3>
      <div className="flex flex-wrap gap-1.5">
        <span className={`${chip} ${urg.cls}`}>{a.urgency === 'overdue' ? (a.daysLate === 1 ? t('1 day late') : t('{n} days late', { n: a.daysLate })) : t(urg.label)}{x.time ? ` · ${x.time}` : ''}</span>
        <span className={`${chip} border-[var(--line)] text-[var(--muted)]`}>{effortLabel(a.mins)}</span>
      </div>
      <p className="m-0 text-[14px] text-[var(--ink)]">
        <b>{t('Good time:')}</b>{' '}
        {a.slot ? slotLabel(a.slot) : t('your day is full; move it to another day')}
      </p>
      <ol className="m-0 pl-5 grid gap-1 text-[14px] text-[var(--ink)] list-decimal marker:text-[var(--muted)]">
        {a.steps.map((s) => <li key={s}>{s}</li>)}
      </ol>
      <p className="m-0 text-[13.5px] text-[var(--muted)] border-t border-dashed border-[var(--line)] pt-2"><b className="text-[var(--ink)]">{t('Tip:')}</b> {a.tip}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
        {a.slot && !slotIsCurrent && <button onClick={schedule} className={cls.link}>{t('Plan it for {when}', { when: slotLabel(a.slot) })}</button>}
        <button onClick={addSteps} disabled={added} className={cls.link + ' disabled:opacity-50 disabled:no-underline disabled:cursor-default'}>{added ? t('Steps added') : t('+ Add steps as tasks')}</button>
        <button onClick={() => editTask(x)} className={cls.link}>{t('Edit task')}</button>
        <button onClick={() => onOpenDay(x.date)} className={cls.link}>{t('Show in Tasks')}</button>
      </div>
    </article>
  );
}

export function HelperView({ onOpenDay }: { onOpenDay: (k: string) => void }) {
  useApp(); // redraw when tasks change
  const [added, setAdded] = useState<string[]>(() => readAdded());
  const [showAll, setShowAll] = useState(false);
  const list = adviseAll();
  const focus = focusLine(list);
  const groups = batches(list);
  const free = freeToday();
  const late = list.filter((a) => a.urgency === 'overdue').length;
  const today = list.filter((a) => a.urgency === 'today').length;
  const week = list.filter((a) => a.urgency === 'tomorrow' || a.urgency === 'week').length;
  const shown = showAll ? list : list.slice(0, 6);

  const moveLate = () => {
    const T = todayIso();
    app.S.tasks.forEach((x) => { if (!x.done && x.date < T) { x.date = T; x.updated = Date.now(); } });
    save(); toast('Moved to today');
  };

  return (
    <div className="pb-28">
      <header className="sticky top-0 z-10 bg-[var(--bg)] flex items-center justify-between gap-3 px-4 pt-[max(16px,env(safe-area-inset-top,0px))] pb-2.5">
        <h1 className="font-display font-extrabold text-[30px] tracking-[-0.02em] leading-none text-[var(--ink)]">{t('Helper')}</h1>
      </header>

      <div className="px-4 grid gap-3">
        <section className="bg-[var(--surface)] rounded-[20px] p-4 shadow-[var(--shadow)] grid gap-3">
          <p className="m-0 text-[15px] font-semibold text-[var(--ink)]">{focus}</p>
          <div className="flex flex-wrap gap-1.5">
            {late > 0 && <span className={`${chip} ${URGENCY.overdue.cls}`}>{t('{n} overdue', { n: late })}</span>}
            <span className={`${chip} border-[var(--line)] text-[var(--ink)]`}>{t('{n} today', { n: today })}</span>
            <span className={`${chip} border-[var(--line)] text-[var(--ink)]`}>{t('{n} this week', { n: week })}</span>
          </div>
          {free.length > 0 && <p className="m-0 text-[14px] text-[var(--muted)]"><b className="text-[var(--ink)]">{t('Free today:')}</b> {free.join(', ')}</p>}
          {late > 0 && <div><button onClick={moveLate} className={cls.link}>{t('Move all overdue tasks to today')}</button></div>}
        </section>

        {groups.map((g) => (
          <section key={g.ids.join()} className="bg-[var(--sun-soft)] text-[var(--sun-ink)] rounded-2xl px-3.5 py-3 text-[14px] font-semibold">
            <span className="block text-[11.5px] uppercase tracking-[0.08em] font-bold opacity-80 mb-0.5">{t('Save time')}</span>
            {g.text}
          </section>
        ))}

        {list.length > 0 && <h2 className="font-display font-semibold text-lg text-[var(--ink)] mt-2 mb-0">{t('How to get each one done')}</h2>}
        {shown.map((a) => (
          <AdviceCard key={a.task.id} a={a} added={added.includes(a.task.id)} onOpenDay={onOpenDay}
            onAdded={() => { const n = [...added, a.task.id]; setAdded(n); writeAdded(n); }} />
        ))}
        {list.length > shown.length && (
          <button onClick={() => setShowAll(true)} className={cls.pill(false) + ' justify-self-center'}>{t('Show {n} more', { n: list.length - shown.length })}</button>
        )}

        <p className="text-[12.5px] text-[var(--muted)] mt-2 max-w-[60ch]">{t('The helper works on this phone from your tasks and calendar. It needs no internet and sends nothing anywhere. Suggestions update as you add, move or tick off tasks.')}</p>
      </div>
    </div>
  );
}
