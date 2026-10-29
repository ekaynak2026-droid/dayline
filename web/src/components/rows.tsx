'use client';
// Task and event rows (used in the Tasks list and the calendar's day list), and their edit windows.

import React, { useState } from 'react';
import type { CalendarEvent, Task } from '@/types';
import { app, closeSheet, openSheet, save, toast } from '@/lib/store';
import { dropFiles, download, filesOf } from '@/lib/files';
import { hasRemind, icsFor, remindHint } from '@/lib/device';
import { todayIso, uid } from '@/lib/dates';
import { FileBox, FileChips, FolderButton, useFileBox } from './file-box';
import { IconBell, IconCheck } from './icons';
import { Actions, RemindSelect, Sheet, cls } from './ui';

export const colorVar = (c: number) => `var(--c${[1, 2, 3, 4].includes(c) ? c : 1})`;

export function toggleTask(t: Task) { t.done = !t.done; save(); }

export function TaskRow({ t }: { t: Task }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 min-h-[44px] border-b border-[var(--line)] last:border-b-0 min-w-0">
      <button type="button" onClick={() => toggleTask(t)} aria-label={t.done ? 'Mark as not done' : 'Mark as done'}
        className={`w-6 h-6 rounded-lg flex items-center justify-center flex-none border-2 transition-colors cursor-pointer ${t.done ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-ink)]' : 'border-[var(--muted)] hover:border-[var(--accent)]'}`}>
        {t.done && <IconCheck className="w-3.5 h-3.5" />}
      </button>
      <button type="button" onClick={() => editTask(t)}
        className={`flex-1 min-w-0 py-2.5 break-words text-left cursor-pointer ${t.done ? 'text-[var(--done)] line-through' : 'text-[var(--ink)] hover:text-[var(--accent)]'}`}>
        {t.text}
      </button>
      {hasRemind(t) && !t.done && <IconBell className="w-3.5 h-3.5 text-[var(--muted)] flex-none" />}
      {t.time && <span className="text-[13px] text-[var(--muted)] flex-none tabular-nums">{t.time}</span>}
      <FolderButton item={t} />
      <FileChips item={t} />
    </li>
  );
}

export function EventRow({ e }: { e: CalendarEvent }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 min-h-[44px] border-b border-[var(--line)] last:border-b-0 min-w-0">
      <span className="w-6 h-1.5 rounded-full flex-none" style={{ backgroundColor: colorVar(e.color) }} />
      <button type="button" onClick={() => editEvent(e)} className="flex-1 min-w-0 font-semibold text-[var(--ink)] py-2.5 break-words text-left cursor-pointer hover:text-[var(--accent)]">
        {e.title}
      </button>
      {hasRemind(e) && <IconBell className="w-3.5 h-3.5 text-[var(--muted)] flex-none" />}
      <span className="text-[13px] text-[var(--muted)] flex-none tabular-nums">{e.time || 'All day'}</span>
      <FolderButton item={e} />
      <FileChips item={e} />
    </li>
  );
}

/* ---------- edit task ---------- */
export function editTask(t: Task | null, date?: string) { openSheet(<TaskSheet key={(t?.id || 'new') + Date.now()} task={t} date={date} />); }

function TaskSheet({ task, date }: { task: Task | null; date?: string }) {
  const isNew = !task;
  const [t] = useState<Task>(() => task || { id: uid(), text: '', date: date || todayIso(), time: '', remind: '', done: false });
  const [text, setText] = useState(t.text);
  const [day, setDay] = useState(t.date);
  const [time, setTime] = useState(t.time || '');
  const [remind, setRemind] = useState(t.remind || '');
  const box = useFileBox(filesOf(t));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) { document.getElementById('ft-text')?.focus(); return; }
    await box.commit(filesOf(t));
    Object.assign(t, { files: [...box.files], text: text.trim(), date: day || todayIso(), time, remind, rset: Date.now() });
    if (isNew) app.S.tasks.push(t);
    save(); closeSheet(); toast(isNew ? 'Task added' : 'Task saved'); remindHint(t);
  };
  const del = async () => {
    await dropFiles(t);
    app.S.tasks = app.S.tasks.filter((x) => x.id !== t.id);
    save(); closeSheet(); toast('Task deleted');
  };

  return (
    <Sheet>
      <h3 className={cls.h3}>{isNew ? 'New task' : 'Edit task'}</h3>
      <form onSubmit={submit} className="grid gap-1.5">
        <label htmlFor="ft-text" className={cls.label}>Task</label>
        <input id="ft-text" autoFocus={isNew} value={text} onChange={(e) => setText(e.target.value)} placeholder="What do you need to do?" autoComplete="off" className={cls.input} />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="min-w-0"><label htmlFor="ft-date" className={cls.label}>Day</label><input id="ft-date" type="date" value={day} onChange={(e) => setDay(e.target.value)} className={cls.input} /></div>
          <div className="min-w-0"><label htmlFor="ft-time" className={cls.label}>Time (optional)</label><input id="ft-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={cls.input} /></div>
        </div>
        <label htmlFor="ft-remind" className={cls.label}>Reminder</label>
        <RemindSelect id="ft-remind" value={remind} onChange={setRemind} />
        <FileBox box={box} />
        <Actions onDelete={isNew ? undefined : del} />
      </form>
    </Sheet>
  );
}

/* ---------- edit event ---------- */
let afterEventSave: ((date: string) => void) | null = null;
/** The calendar listens here so it can jump to the saved event's day. */
export function onEventSaved(f: typeof afterEventSave) { afterEventSave = f; }

export function editEvent(ev: CalendarEvent | null, date?: string) { openSheet(<EventSheet key={(ev?.id || 'new') + Date.now()} event={ev} date={date} />); }

function EventSheet({ event, date }: { event: CalendarEvent | null; date?: string }) {
  const isNew = !event;
  const [ev] = useState<CalendarEvent>(() => event || { id: uid(), title: '', date: date || todayIso(), time: '', remind: '', color: 1 });
  const [title, setTitle] = useState(ev.title);
  const [day, setDay] = useState(ev.date);
  const [time, setTime] = useState(ev.time || '');
  const [remind, setRemind] = useState(ev.remind || '');
  const [color, setColor] = useState(ev.color || 1);
  const box = useFileBox(filesOf(ev));
  const read = () => ({ ...ev, title: title.trim(), date: day || todayIso(), time, remind, color });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = read();
    if (!n.title) { document.getElementById('fe-title')?.focus(); return; }
    await box.commit(filesOf(ev));
    Object.assign(ev, n, { files: [...box.files], rset: Date.now() });
    if (isNew) app.S.events.push(ev);
    save(); closeSheet(); afterEventSave?.(ev.date); toast(isNew ? 'Event pinned' : 'Event saved'); remindHint(ev);
  };
  const del = async () => {
    await dropFiles(ev);
    app.S.events = app.S.events.filter((x) => x.id !== ev.id);
    save(); closeSheet(); toast('Event deleted');
  };
  const ics = () => {
    const n = read();
    if (!n.title) { toast('Give the event a name first'); return; }
    download((n.title.replace(/[^\w ]+/g, '').trim() || 'event') + '.ics', icsFor(n), 'text/calendar');
  };

  return (
    <Sheet>
      <h3 className={cls.h3}>{isNew ? 'New event' : 'Edit event'}</h3>
      <form onSubmit={submit} className="grid gap-1.5">
        <label htmlFor="fe-title" className={cls.label}>Event</label>
        <input id="fe-title" autoFocus={isNew} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dentist, Birthday, Flight" autoComplete="off" className={cls.input} />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="min-w-0"><label htmlFor="fe-date" className={cls.label}>Date</label><input id="fe-date" type="date" value={day} onChange={(e) => setDay(e.target.value)} className={cls.input} /></div>
          <div className="min-w-0"><label htmlFor="fe-time" className={cls.label}>Time (empty = all day)</label><input id="fe-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={cls.input} /></div>
        </div>
        <label htmlFor="fe-remind" className={cls.label}>Reminder</label>
        <RemindSelect id="fe-remind" value={remind} onChange={setRemind} />
        <span className={cls.label}>Colour</span>
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Colour ${c}`} aria-pressed={color === c}
              className={`w-9 h-9 rounded-full cursor-pointer border-[3px] ${color === c ? 'border-[var(--ink)]' : 'border-transparent'}`} style={{ backgroundColor: colorVar(c) }} />
          ))}
        </div>
        <FileBox box={box} />
        <div><button type="button" onClick={ics} className={cls.link + ' py-2'}>Also add to my phone&apos;s calendar</button></div>
        <Actions onDelete={isNew ? undefined : del} />
      </form>
    </Sheet>
  );
}

export const hasAnyFiles = (x: { files?: unknown[] }) => !!x.files?.length;
