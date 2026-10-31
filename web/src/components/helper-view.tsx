'use client';
// The Helper tab: the sketch pad, a page for quick drafts and drawings.

import React from 'react';
import { useApp } from '@/lib/store';
import { t } from '@/lib/i18n';
import { SketchPad } from './sketch-pad';

export function HelperView() {
  useApp();
  return (
    <div className="pb-28">
      <header className="sticky top-0 z-10 bg-[var(--bg)] flex items-center justify-between gap-3 px-4 pt-[max(16px,env(safe-area-inset-top,0px))] pb-2.5">
        <h1 className="font-display font-extrabold text-[30px] tracking-[-0.02em] leading-none text-[var(--ink)]">{t('Sketch pad')}</h1>
      </header>

      <div className="px-4 grid gap-3">
        <SketchPad />
      </div>
    </div>
  );
}
