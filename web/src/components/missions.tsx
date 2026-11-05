'use client';
// The Missions card in the Helper tab: tasks with a Mis.A / Mis.B / Mis.C keyword, what the assistant did
// for each, and buttons to open the result or run the mission again. See lib/mission.ts.

import React from 'react';
import { useApp } from '@/lib/store';
import { currentSkill, missionStatus, missionTasks, plainText, resultNote, runMission, stopMission } from '@/lib/mission';
import { t } from '@/lib/i18n';
import { editNote } from './notes-view';
import { cls } from './ui';

export function Missions() {
  useApp();
  const list = missionTasks().filter((m) => !m.x.done).slice(0, 15);
  const kinds = currentSkill().kinds;
  const title = (k: string) => kinds.find((x) => x.key === k)?.title || '';
  return (
    <section className="bg-[var(--surface)] rounded-[20px] p-4 shadow-[var(--shadow)] grid gap-2.5">
      <h2 className="m-0 font-display font-semibold text-lg text-[var(--ink)]">{t('Missions')}</h2>
      {!list.length && (
        <p className="m-0 text-[14px] text-[var(--muted)]">
          {t('Write a keyword in a task and the assistant does it by itself:')}{' '}
          {kinds.map((k) => `Mis.${k.key} = ${k.title}`).join('; ')}.
        </p>
      )}
      {list.map(({ x, keys }) => (
        <div key={x.id} className="border-t border-dashed border-[var(--line)] pt-2 grid gap-1.5 min-w-0">
          <b className="text-[15px] text-[var(--ink)] break-words">{plainText(x.text)}</b>
          {keys.map((k) => {
            const n = resultNote(x.id, k), sid = x.id + ':' + k, running = missionStatus.running === sid, err = missionStatus.errors[sid];
            return (
              <div key={k} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px]">
                <span className="font-bold text-[var(--accent)]">Mis.{k}</span>
                <span className="text-[var(--muted)]">{title(k)}</span>
                <span className={err ? 'text-[var(--danger)] font-semibold' : 'text-[var(--muted)]'}>
                  {running ? t('Working…') : err ? err : n ? t('Done') : t('Waiting')}
                </span>
                {n && !running && <button type="button" onClick={() => editNote(n, false)} className={cls.link}>{t('Open result')}</button>}
                {running ? <button type="button" onClick={stopMission} className={cls.link + ' !text-[var(--muted)]'}>{t('Stop')}</button>
                  : <button type="button" disabled={!!missionStatus.running} onClick={() => runMission(x.id, k)} className={cls.link + ' disabled:opacity-40'}>{t(n ? 'Run again' : 'Run now')}</button>}
              </div>
            );
          })}
        </div>
      ))}
      <p className="m-0 text-[12.5px] text-[var(--muted)]">{t('Results are saved in Notes. Missions run while Dayline is open, when a task with a keyword is new or changed. For Mis.B, write your answers in the result note; the next missions for that task use them.')}</p>
    </section>
  );
}
