'use client';
// The Calendar tab: a month grid (Monday first) with events and every task on its day, and the chosen day below.

import React, { useEffect, useState } from 'react';
import type { CalendarEvent, Task } from '@/types';
import { app, useApp } from '@/lib/store';
import { addDays, byTime, cap, fmt, fromIso, iso, todayIso } from '@/lib/dates';
import { t, weekdays } from '@/lib/i18n';
import { EventRow, TaskRow, colorVar, editEvent, onEventSaved } from './rows';
import { IconLeft, IconRight } from './icons';
import { cls } from './ui';
import { getCalDay, setCalDay } from '@/lib/ui-state';

type Pin = (CalendarEvent & { kind: 'event' }) | (Task & { kind: 'task' });
/** Events and all tasks of a day, sorted by time (timed ones first): these are "pinned" on the calendar. */
export const pinned = (k: string): Pin[] => [
  ...app.S.events.filter((e) => e.date === k).map((e) => ({ ...e, kind: 'event' as const })),
  ...app.S.tasks.filter((t) => t.date === k).map((t) => ({ ...t, kind: 'task' as const })),
].sort(byTime);

const monthOf = (k: string) => { const d = fromIso(k); return new Date(d.getFullYear(), d.getMonth(), 1); };


export function CalendarView({ onSeeTasks }: { onSeeTasks: (k: string) => void }) {
  const { S } = useApp();
  const T = todayIso();
  const [selDay, setSel] = useState(() => getCalDay() || T);
  const [month, setMonth] = useState(() => monthOf(getCalDay() || T));
  const pick = (k: string) => { setCalDay(k); setSel(k); const m = monthOf(k); if (m.getTime() !== month.getTime()) setMonth(m); };

  // After saving an event, jump to its day.
  useEffect(() => { onEventSaved((k) => { setCalDay(k); setSel(k); setMonth(monthOf(k)); }); return () => onEventSaved(null); }, []);

  const y = month.getFullYear(), m = month.getMonth();
  const offset = (month.getDay() + 6) % 7, start = addDays(month, -offset);
  const weeks = Math.ceil((offset + new Date(y, m + 1, 0).getDate()) / 7);
  const pins = pinned(selDay);
  const tc = S.tasks.filter((t) => t.date === selDay).length;
  // Show the real items (not copies) in the day list, so ticking and editing work.
  const real = (p: Pin) => p.kind === 'event' ? S.events.find((e) => e.id === p.id) : S.tasks.find((t) => t.id === p.id);

  return (
    <div className="pb-28">
      <header className="sticky top-0 z-10 bg-[var(--bg)] flex items-center justify-between gap-3 px-4 pt-[max(16px,env(safe-area-inset-top,0px))] pb-2.5">
        <h1 className="font-display font-extrabold text-[30px] tracking-[-0.02em] leading-none text-[var(--ink)]">
          {cap(fmt(month, { month: 'long' }))} <span className="text-[var(--muted)] font-semibold">{y}</span>
        </h1>
        <div className="flex items-center gap-1">
          <button onClick={() => setMonth(new Date(y, m - 1, 1))} aria-label={t('Previous month')} className="w-[38px] h-[38px] rounded-xl flex items-center justify-center border border-[var(--line)] bg-[var(--surface)] hover:border-[var(--muted)] cursor-pointer"><IconLeft /></button>
          <button onClick={() => setMonth(new Date(y, m + 1, 1))} aria-label={t('Next month')} className="w-[38px] h-[38px] rounded-xl flex items-center justify-center border border-[var(--line)] bg-[var(--surface)] hover:border-[var(--muted)] cursor-pointer"><IconRight /></button>
        </div>
      </header>

      <div className="px-4">
        <div className="grid grid-cols-7 text-[11px] font-bold tracking-[0.08em] uppercase text-[var(--muted)] text-center py-1">
          {weekdays().map((w) => <span key={w}>{w}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-[3px]">
          {Array.from({ length: weeks * 7 }).map((_, i) => {
            const d = addDays(start, i), k = iso(d), ps = pinned(k);
            return (
              <button key={k} type="button" onClick={() => pick(k)}
                aria-label={t('{date}, {n} pinned', { date: fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }), n: ps.length })}
                className={`min-h-[70px] bg-[var(--surface)] rounded-[10px] px-0.5 py-1 flex flex-col items-stretch gap-0.5 text-left border-2 cursor-pointer min-w-0 ${d.getMonth() !== m ? 'opacity-40' : ''} ${k === selDay ? 'border-[var(--accent)]' : 'border-transparent'}`}>
                <span className={`text-[13px] font-semibold self-center w-6 h-6 flex items-center justify-center rounded-full tabular-nums ${k === T ? 'bg-[var(--sun)] text-[#3A2C00] font-extrabold' : 'text-[var(--ink)]'}`}>{d.getDate()}</span>
                {ps.slice(0, 2).map((p) => p.kind === 'event' ? (
                  <span key={p.id} className="text-[10px] leading-tight font-semibold rounded-[3px] px-[3px] py-0.5 overflow-hidden whitespace-nowrap text-[var(--ink)]"
                    style={{ borderLeft: `3px solid ${colorVar(p.color)}`, backgroundColor: `color-mix(in srgb, ${colorVar(p.color)} 18%, var(--surface))` }}>{p.title}</span>
                ) : (
                  <span key={p.id} className={`text-[10px] leading-tight font-semibold rounded-[3px] px-[3px] py-0.5 overflow-hidden whitespace-nowrap border-l-[3px] border-[var(--muted)] bg-[var(--bg)] ${p.done ? 'line-through text-[var(--done)]' : 'text-[var(--ink)]'}`}>{p.text}</span>
                ))}
                {ps.length > 2 && <span className="text-[10px] text-[var(--muted)] text-center font-semibold whitespace-nowrap">{t('+{n} more', { n: ps.length - 2 })}</span>}
              </button>
            );
          })}
        </div>

        <section className="mt-[18px] bg-[var(--surface)] rounded-[20px] p-4 pb-2 shadow-[var(--shadow)]">
          <h3 className="font-display font-semibold text-[19px] text-[var(--ink)] mb-1">
            {selDay === T ? t('Today, ') : ''}{(selDay === T ? (s: string) => s : cap)(fmt(fromIso(selDay), { weekday: 'long', day: 'numeric', month: 'long' }))}
          </h3>
          {pins.length ? (
            <ul className="list-none m-0 p-0">
              {pins.map((p) => { const r = real(p); if (!r) return null; return p.kind === 'event' ? <EventRow key={p.id} e={r as CalendarEvent} /> : <TaskRow key={p.id} t={r as Task} />; })}
            </ul>
          ) : <p className="text-[var(--muted)] text-[14px] py-2">{t('Nothing pinned on this day yet.')}</p>}
          <div className="flex gap-4 flex-wrap py-2.5 pt-3">
            <button onClick={() => editEvent(null, selDay)} className={cls.link}>{t('+ Add event')}</button>
            {tc > 0 && <button onClick={() => onSeeTasks(selDay)} className={cls.link}>{t('Open this day in Tasks')}</button>}
            {selDay !== T && <button onClick={() => pick(T)} className={cls.link}>{t('Back to today')}</button>}
          </div>
        </section>
      </div>
    </div>
  );
}
