'use client';
// The Tasks tab: today in front, earlier days above, later days below.

import React, { useEffect, useState } from 'react';
import { app, save, toast, useApp } from '@/lib/store';
import { addDays, byTime, fmt, fromIso, iso, todayDate, todayIso, uid } from '@/lib/dates';
import { canInstall, isIOS, runInstall, standalone } from '@/lib/device';
import { EventRow, TaskRow } from './rows';
import { openSettings } from './settings-sheet';
import { IconGear } from './icons';
import { cls } from './ui';

export function scrollToDay(k: string, smooth = false) {
  document.getElementById(`day-${k}`)?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
}

function dayKeys() {
  const S = app.S, T0 = todayDate(), from = iso(addDays(T0, -14));
  const set = new Set<string>();
  for (let i = -14; i <= 60; i++) set.add(iso(addDays(T0, i)));
  S.tasks.forEach((t) => set.add(t.date));
  S.events.forEach((e) => { if (e.date >= from) set.add(e.date); });
  return [...set].sort();
}

export function InstallSteps() {
  if (isIOS()) return (
    <ol className="list-decimal pl-5 m-0 text-[14px] grid gap-1">
      <li>Open this page in <b>Safari</b>.</li>
      <li>Tap the <b>Share</b> button (the square with an arrow pointing up).</li>
      <li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
    </ol>
  );
  if (canInstall()) return <p className="m-0 text-[14px]">Tap the button to add Dayline to your home screen.</p>;
  return (
    <ol className="list-decimal pl-5 m-0 text-[14px] grid gap-1">
      <li>Open this page in <b>Chrome</b>.</li>
      <li>Tap the <b>⋮</b> menu at the top right.</li>
      <li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li>
    </ol>
  );
}

export function TasksView() {
  const { S } = useApp();
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const T = todayIso(), T0 = todayDate();
  const overdue = S.tasks.filter((t) => !t.done && t.date < T).length;
  const isStandalone = standalone();

  // Open on today, not two weeks ago.
  useEffect(() => { requestAnimationFrame(() => scrollToDay(todayIso())); }, []);

  const add = (k: string, e: React.FormEvent) => {
    e.preventDefault();
    const val = (inputs[k] || '').trim(); if (!val) return;
    app.S.tasks.push({ id: uid(), text: val, date: k, time: '', remind: '', done: false });
    save();
    setInputs((p) => ({ ...p, [k]: '' }));
  };
  const carry = () => { app.S.tasks.forEach((t) => { if (!t.done && t.date < T) t.date = T; }); save(); toast('Moved to today'); };

  return (
    <div className="pb-28">
      <header className="sticky top-0 z-10 bg-[var(--bg)] flex items-center justify-between gap-3 px-4 pt-[max(16px,env(safe-area-inset-top,0px))] pb-2.5">
        <h1 className="font-display font-extrabold text-[30px] tracking-[-0.02em] leading-none text-[var(--ink)]">Tasks</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => scrollToDay(T, true)} className="border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] rounded-full px-3.5 py-1.5 font-semibold text-sm hover:border-[var(--muted)] cursor-pointer">Today</button>
          <button onClick={openSettings} aria-label="Settings" className="w-[38px] h-[38px] rounded-xl flex items-center justify-center border border-[var(--line)] bg-[var(--surface)] hover:border-[var(--muted)] cursor-pointer">
            <IconGear className="w-5 h-5 text-[var(--muted)]" />
          </button>
        </div>
      </header>

      <div className="px-4">
        {!isStandalone && !S.installDismissed && (
          <div className="bg-[var(--sun-soft)] text-[var(--sun-ink)] rounded-2xl p-3.5 my-2 grid gap-2">
            <div><b>Put Dayline on your home screen</b> so it opens like a normal app and works without internet.</div>
            <InstallSteps />
            <div className="flex gap-2">
              {canInstall() && <button onClick={runInstall} className={cls.pill(true)}>Install</button>}
              <button onClick={() => { app.S.installDismissed = true; save(); toast('You can find this again in Settings'); }} className={cls.pill(false)}>Not now</button>
            </div>
          </div>
        )}

        {dayKeys().map((k) => {
          const d = fromIso(k), i = Math.round((d.getTime() - T0.getTime()) / 864e5);
          const isToday = i === 0, isPast = i < 0;
          const ts = S.tasks.filter((t) => t.date === k).sort(byTime);
          const es = S.events.filter((e) => e.date === k).sort(byTime);
          const name = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : i === -1 ? 'Yesterday' : fmt(d, { weekday: 'long' });
          const sub = Math.abs(i) <= 1 ? fmt(d, { weekday: 'short', day: 'numeric', month: 'long' })
            : fmt(d, { day: 'numeric', month: 'long', ...(d.getFullYear() !== T0.getFullYear() ? { year: 'numeric' } : {}) });
          return (
            <section key={k} id={`day-${k}`}
              className={`scroll-mt-[68px] py-2.5 border-b border-[var(--line)] ${isToday ? 'bg-[var(--surface)] border-0 rounded-[20px] p-4 my-3 shadow-[var(--shadow)]' : isPast ? 'opacity-80' : ''}`}>
              <h2 className={`flex items-baseline gap-2 mb-1 font-display font-semibold text-[var(--ink)] ${isToday ? 'text-[28px] font-extrabold tracking-[-0.02em] flex-wrap' : 'text-lg'}`}>
                <span>{name}</span>
                <small className={isToday ? 'bg-[var(--sun)] text-[#3A2C00] px-2.5 py-0.5 rounded-full text-[12.5px] font-bold font-body' : 'font-body font-medium text-[13px] text-[var(--muted)]'}>{sub}</small>
              </h2>
              {isToday && overdue > 0 && (
                <div className="flex items-center justify-between gap-2.5 flex-wrap bg-[var(--sun-soft)] text-[var(--sun-ink)] rounded-xl px-3 py-2 my-1.5 text-[13.5px] font-semibold">
                  <span>{overdue} unfinished from earlier days</span>
                  <button onClick={carry} className="font-bold underline cursor-pointer">Move to today</button>
                </div>
              )}
              {isToday && !S.tasks.length && <p className="text-[14px] text-[var(--muted)] my-1">Type below to add your first task. Tap + to give it a time or a reminder.</p>}
              <ul className="list-none m-0 p-0">
                {es.map((e) => <EventRow key={e.id} e={e} />)}
                {ts.map((t) => <TaskRow key={t.id} t={t} />)}
              </ul>
              <form onSubmit={(e) => add(k, e)} className="flex items-center gap-3 min-h-[40px] mt-1">
                <span aria-hidden="true" className="w-6 text-center text-[var(--muted)] text-xl leading-none select-none">+</span>
                <input value={inputs[k] || ''} onChange={(e) => setInputs((p) => ({ ...p, [k]: e.target.value }))}
                  aria-label={`Add a task for ${name}`} placeholder={isToday ? 'Add a task for today' : 'Add a task'} autoComplete="off" enterKeyHint="done"
                  className="flex-1 min-w-0 bg-transparent border-0 py-2 outline-none text-[16px] text-[var(--ink)] placeholder:text-[var(--muted)]" />
              </form>
            </section>
          );
        })}
      </div>
    </div>
  );
}
