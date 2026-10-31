'use client';
// The AI assistant in the Helper tab (only when a Gemini key is saved in Settings): advice for
// each open task, and a chat about the planner. Answers come from Google Gemini (see lib/ai.ts).

import React, { useEffect, useRef, useState } from 'react';
import { app, save, toast, useApp } from '@/lib/store';
import { addDays, byTime, fmt, fromIso, iso, todayDate, todayIso, uid } from '@/lib/dates';
import { getLang, t } from '@/lib/i18n';
import { AiError, askAi, stopAi, type ChatMsg } from '@/lib/ai';
import { editTask } from './rows';
import { cls } from './ui';

const dayDiff = (k: string) => Math.round((fromIso(k).getTime() - todayDate().getTime()) / 864e5);
const whenText = (k: string) => { const d = dayDiff(k); return d === -1 ? t('1 day late') : d < 0 ? t('{n} days late', { n: -d }) : d === 0 ? t('Today') : d === 1 ? t('Tomorrow') : fmt(fromIso(k), { weekday: 'short', day: 'numeric', month: 'short' }); };

/** Open tasks that matter now: late ones and the next week, most urgent first. */
function openTasks(limit: number) {
  const last = iso(addDays(todayDate(), 7));
  return app.S.tasks.filter((x) => !x.done && x.date <= last)
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : byTime(a, b)).slice(0, limit);
}

/** The planner, written out for the model. Short ids keep the prompt small. */
function plannerText(ids: Map<string, string>) {
  const T = todayIso(), last = iso(addDays(todayDate(), 14));
  const tasks = app.S.tasks.filter((x) => !x.done && x.date <= last).sort((a, b) => a.date < b.date ? -1 : 1).slice(0, 30);
  const events = app.S.events.filter((e) => e.date >= T && e.date <= last).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : byTime(a, b)).slice(0, 20);
  tasks.forEach((x, i) => ids.set('T' + (i + 1), x.id));
  return `Today is ${fmt(todayDate(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} (${T}).\n`
    + `Open tasks (id | date | time | task):\n${tasks.length ? tasks.map((x, i) => `T${i + 1} | ${x.date}${x.date < T ? ' (overdue)' : ''} | ${x.time || '-'} | ${x.text}`).join('\n') : '(none)'}\n`
    + `Calendar events, next 14 days:\n${events.length ? events.map((e) => `${e.date} ${e.time || 'all day'} - ${e.title}`).join('\n') : '(none)'}`;
}
const LANG = () => (getLang() === 'ru' ? 'Answer in Russian.' : 'Answer in English.');

interface Tip { id: string; steps: string[]; time: string; when: string; tip: string; added?: boolean }

function TipCard({ tip, onAdded }: { tip: Tip; onAdded: () => void }) {
  const x = app.S.tasks.find((k) => k.id === tip.id); if (!x) return null;
  const T = todayIso(), day = x.date < T ? T : x.date;
  const planned = /^\d{2}:\d{2}$/.test(tip.when) && !(x.date === day && x.time === tip.when);
  const plan = () => { x.date = day; x.time = tip.when; x.updated = Date.now(); save(); toast(t('Planned for {when}', { when: `${whenText(day)} ${tip.when}` })); };
  const addSteps = () => {
    tip.steps.forEach((s) => app.S.tasks.push({ id: uid(), text: `${s} (${x.text})`, date: day, time: '', remind: '', done: false, updated: Date.now() }));
    save(); onAdded(); toast(t('Added {n} steps to your list', { n: tip.steps.length }));
  };
  return (
    <article className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-3.5 grid gap-2 min-w-0">
      <h3 className={`m-0 font-display font-semibold text-[17px] leading-snug break-words ${x.done ? 'line-through text-[var(--done)]' : 'text-[var(--ink)]'}`}>{x.text}</h3>
      <div className="flex flex-wrap gap-1.5 text-[12px] font-semibold">
        <span className={`border rounded-full px-2 py-0.5 ${x.date < T ? 'bg-[var(--sun-soft)] text-[var(--sun-ink)] border-[var(--sun)]' : 'border-[var(--line)] text-[var(--ink)]'}`}>{whenText(x.date)}{x.time ? ` · ${x.time}` : ''}</span>
        {tip.time && <span className="border border-[var(--line)] rounded-full px-2 py-0.5 text-[var(--muted)]">{tip.time}</span>}
      </div>
      {tip.steps.length > 0 && <ol className="m-0 pl-5 grid gap-1 text-[14px] text-[var(--ink)] list-decimal marker:text-[var(--muted)]">{tip.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}
      {tip.tip && <p className="m-0 text-[13.5px] text-[var(--muted)] border-t border-dashed border-[var(--line)] pt-2"><b className="text-[var(--ink)]">{t('Tip:')}</b> {tip.tip}</p>}
      <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
        {planned && !x.done && <button type="button" onClick={plan} className={cls.link}>{t('Plan it for {when}', { when: `${whenText(day)} ${tip.when}` })}</button>}
        {tip.steps.length > 0 && !x.done && <button type="button" onClick={addSteps} disabled={tip.added} className={cls.link + ' disabled:opacity-50 disabled:cursor-default'}>{tip.added ? t('Steps added') : t('+ Add steps as tasks')}</button>}
        <button type="button" onClick={() => editTask(x)} className={cls.link}>{t('Edit task')}</button>
      </div>
    </article>
  );
}

export function Assistant() {
  useApp();
  const [tips, setTips] = useState<Tip[]>([]);
  const [focus, setFocus] = useState('');
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [live, setLive] = useState('');
  const [mode, setMode] = useState<'' | 'review' | 'chat'>('');
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [chat.length, live]);

  const busy = mode !== '';

  const review = async () => {
    const list = openTasks(8);
    if (!list.length) { toast('No open tasks for the coming week'); return; }
    const ids = new Map<string, string>(); const ctx = plannerText(ids);
    const back = new Map([...ids].map(([k, v]) => [v, k]));
    const want = list.map((x) => back.get(x.id)).filter(Boolean).join(', ');
    setMode('review'); setErr(''); setTips([]); setFocus(''); setLive('');
    const prompt = `You are the helper inside a personal day planner. Help the user actually get their tasks done.\n${LANG()}\n`
      + `Reply with one JSON object per line and nothing else (no code fences).\n`
      + `First line: {"focus":"one or two sentences: what to do first and why"}\n`
      + `Then one line for each of these tasks, most urgent first: ${want}\n`
      + `{"id":"T1","steps":["3 or 4 short, concrete first steps"],"time":"rough effort, e.g. 20 min","when":"HH:MM, a good free time on the task's day (or today if overdue) that avoids the events","tip":"one practical tip"}\n\n${ctx}`;
    const got: Tip[] = []; let seen = 0;
    const parse = (s: string, final: boolean) => {
      const lines = s.split('\n'); if (!final) lines.pop();
      for (; seen < lines.length; seen++) {
        const line = lines[seen].trim().replace(/^```\w*|```$/g, '').trim();
        if (!line.startsWith('{')) continue;
        try {
          const o = JSON.parse(line);
          if (o.focus) setFocus(String(o.focus));
          const id = ids.get(String(o.id || ''));
          if (id && !got.some((g) => g.id === id)) {
            got.push({ id, steps: Array.isArray(o.steps) ? o.steps.map(String).slice(0, 5) : [], time: String(o.time || ''), when: String(o.when || '').slice(0, 5), tip: String(o.tip || '') });
            setTips([...got]);
          }
        } catch { /* half-written line */ }
      }
    };
    try {
      const full = await askAi(prompt, [{ role: 'user', content: 'Give the advice now.' }], (s) => parse(s, false), 1100);
      parse(full, true);
      if (!got.length) setErr(t('The assistant did not answer in the expected way. Try again.'));
    } catch (e) { setErr(t(e instanceof AiError ? e.message : 'The assistant stopped. Try again.')); }
    setMode('');
  };

  const send = async (text: string) => {
    text = text.trim(); if (!text || busy) return;
    const next: ChatMsg[] = [...chat, { role: 'user', content: text }];
    setChat(next); setQ(''); setMode('chat'); setLive(''); setErr('');
    const ids = new Map<string, string>();
    const rules = `You are the helper inside the user's personal day planner app. Answer questions about their tasks and how to get them done. Be practical and brief: a few short sentences or a short list, plain text. Refer to tasks by name, never by id. ${LANG()}\n\n${plannerText(ids)}`;
    try {
      const ans = await askAi(rules, next.slice(-8), setLive, 450);
      setChat([...next, { role: 'assistant', content: ans || t('(no answer)') }]);
    } catch (e) { setErr(t(e instanceof AiError ? e.message : 'The assistant stopped. Try again.')); setChat(next); }
    setLive(''); setMode('');
  };

  return (
    <div className="grid gap-3">
      <section className="bg-[var(--surface)] rounded-[20px] p-4 shadow-[var(--shadow)] grid gap-2.5">
        <p className="m-0 text-[15px] text-[var(--ink)]">{t('I read your open tasks and calendar and suggest how to get each one done. Your tasks and events are sent to Google Gemini only when you ask.')}</p>
        <div className="flex gap-2 flex-wrap items-center">
          <button type="button" onClick={review} disabled={busy} className={cls.primary}>{t(tips.length ? 'Review again' : 'Review my tasks')}</button>
          {busy && <button type="button" onClick={stopAi} className={cls.ghost}>{t('Stop')}</button>}
          {mode === 'review' && <span className="text-[13.5px] text-[var(--muted)]" role="status">{t('Thinking… {n} done', { n: tips.length })}</span>}
        </div>
        {err && !chat.length && <p role="alert" className="m-0 text-[var(--danger)] text-[14px] font-semibold">{err}</p>}
      </section>

      {focus && <div className="bg-[var(--sun-soft)] text-[var(--sun-ink)] rounded-2xl px-3.5 py-3 text-[14.5px] font-semibold"><span className="block text-[11.5px] uppercase tracking-[0.08em] font-bold opacity-80 mb-0.5">{t('Start here')}</span>{focus}</div>}
      {tips.map((tp) => <TipCard key={tp.id} tip={tp} onAdded={() => setTips((l) => l.map((x) => x.id === tp.id ? { ...x, added: true } : x))} />)}

      <h2 className="font-display font-semibold text-lg text-[var(--ink)] mt-2 mb-0">{t('Ask about your tasks')}</h2>
      <div className="grid gap-2">
        {chat.map((m, i) => (
          <div key={i} className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl text-[14.5px] whitespace-pre-wrap break-words ${m.role === 'user' ? 'justify-self-end bg-[var(--accent)] text-[var(--accent-ink)] rounded-br-md' : 'justify-self-start bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] rounded-bl-md'}`}>{m.content}</div>
        ))}
        {mode === 'chat' && <div className="max-w-[88%] justify-self-start px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-[var(--surface)] border border-[var(--line)] text-[14.5px] whitespace-pre-wrap break-words text-[var(--ink)]">{live || <span className="text-[var(--muted)]">{t('Thinking…')}</span>}</div>}
        <div ref={endRef} />
      </div>
      {!chat.length && !busy && (
        <div className="flex flex-wrap gap-1.5">
          {['What should I do first today?', 'Which tasks can I do together?', 'Help me plan tomorrow'].map((s) => (
            <button key={s} type="button" onClick={() => send(t(s))} className={cls.pill(false) + ' !text-[13px]'}>{t(s)}</button>
          ))}
        </div>
      )}
      {err && chat.length > 0 && <p role="alert" className="m-0 text-[var(--danger)] text-[14px] font-semibold">{err}</p>}
      <form onSubmit={(e) => { e.preventDefault(); send(q); }} className="flex gap-2 items-center bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-1.5 pl-3.5">
        <input id="as-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Ask the assistant')} autoComplete="off" enterKeyHint="send"
          className="flex-1 min-w-0 bg-transparent border-0 py-2 outline-none text-[16px] text-[var(--ink)] placeholder:text-[var(--muted)]" />
        <button type="submit" disabled={busy || !q.trim()} className={cls.primary + ' py-2 px-4'}>{t('Ask')}</button>
      </form>
      {chat.length > 0 && !busy && <div><button type="button" onClick={() => setChat([])} className={cls.link}>{t('Clear chat')}</button></div>}
      <p className="text-[12.5px] text-[var(--muted)] max-w-[60ch] m-0">{t('The assistant uses Google Gemini and can make mistakes. Check dates and details before you rely on them.')}</p>
    </div>
  );
}
