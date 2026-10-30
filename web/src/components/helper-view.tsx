'use client';
// The Helper tab. Always: the sketch pad, a page for quick drafts and drawings.
// When the AI assistant is turned on in Settings, it also has the Assistant (chat and task advice).

import React, { useState } from 'react';
import { useApp } from '@/lib/store';
import { t } from '@/lib/i18n';
import { aiEnabled } from '@/lib/ai';
import { Assistant } from './assistant';
import { SketchPad } from './sketch-pad';
import { openSettings } from './settings-sheet';
import { cls } from './ui';

type Mode = 'assistant' | 'sketch';
let lastMode: Mode | null = null; // remembered while switching tabs

const HINT_KEY = 'dayline-ai-hint-hidden';
const hintHidden = () => { try { return localStorage.getItem(HINT_KEY) === '1'; } catch { return false; } };

export function HelperView() {
  useApp();
  const on = aiEnabled();
  const [mode, setModeState] = useState<Mode>(() => lastMode || (on ? 'assistant' : 'sketch'));
  const [hideHint, setHideHint] = useState(hintHidden);
  const setMode = (m: Mode) => { lastMode = m; setModeState(m); };
  const shown: Mode = on ? mode : 'sketch';

  return (
    <div className="pb-28">
      <header className="sticky top-0 z-10 bg-[var(--bg)] flex items-center justify-between gap-3 px-4 pt-[max(16px,env(safe-area-inset-top,0px))] pb-2.5">
        <h1 className="font-display font-extrabold text-[30px] tracking-[-0.02em] leading-none text-[var(--ink)]">{t(shown === 'sketch' ? 'Sketch pad' : 'Helper')}</h1>
        {on && (
          <div className="flex gap-1 bg-[var(--surface)] border border-[var(--line)] rounded-full p-1" role="tablist" aria-label={t('Helper')}>
            {([['assistant', 'Assistant'], ['sketch', 'Sketch']] as [Mode, string][]).map(([m, l]) => (
              <button key={m} type="button" role="tab" aria-selected={shown === m} onClick={() => setMode(m)}
                className={`rounded-full px-3 py-1 text-sm font-semibold cursor-pointer ${shown === m ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--ink)]'}`}>{t(l)}</button>
            ))}
          </div>
        )}
      </header>

      <div className="px-4 grid gap-3">
        {!on && !hideHint && (
          <div className="bg-[var(--surface)] border border-dashed border-[var(--line)] rounded-2xl px-3.5 py-3 text-[14px] text-[var(--muted)] grid gap-1.5">
            <span><b className="text-[var(--ink)]">{t('Want an AI assistant here?')}</b> {t('Turn it on in Settings to chat about your tasks and get advice for each one. It runs on this phone.')}</span>
            <span className="flex gap-4">
              <button type="button" onClick={openSettings} className={cls.link}>{t('Open Settings')}</button>
              <button type="button" onClick={() => { setHideHint(true); try { localStorage.setItem(HINT_KEY, '1'); } catch { /* private mode */ } }} className={cls.link + ' !text-[var(--muted)]'}>{t('Hide')}</button>
            </span>
          </div>
        )}
        {shown === 'assistant' ? <Assistant /> : <SketchPad />}
      </div>
    </div>
  );
}
