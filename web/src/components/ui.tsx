'use client';
// Shared building blocks: the slide-up edit window ("sheet"), form styles and buttons.

import React, { useEffect } from 'react';
import { closeSheet } from '@/lib/store';
import { REMIND } from '@/lib/device';
import { t } from '@/lib/i18n';

export const cls = {
  h3: 'font-display font-extrabold text-[22px] tracking-[-0.01em] text-[var(--ink)] mb-3',
  label: 'block text-xs font-bold uppercase tracking-[0.06em] text-[var(--muted)] mt-2',
  input: 'w-full min-w-0 border border-[var(--line)] bg-[var(--bg)] rounded-xl p-3 text-[16px] text-[var(--ink)] outline-none focus:border-[var(--accent)]',
  primary: 'bg-[var(--accent)] text-[var(--accent-ink)] font-bold rounded-xl py-2.5 px-5 hover:opacity-90 cursor-pointer disabled:opacity-50',
  ghost: 'rounded-xl py-2.5 px-3.5 font-semibold text-[var(--muted)] hover:bg-[var(--line)]/50 cursor-pointer',
  link: 'text-[var(--accent)] font-bold text-sm cursor-pointer hover:underline text-left',
  danger: 'text-[var(--danger)] font-semibold rounded-xl py-2.5 px-3.5 hover:bg-red-500/10 cursor-pointer',
  choice: 'w-full flex items-center gap-3.5 p-3.5 border border-[var(--line)] rounded-2xl bg-[var(--bg)] text-left cursor-pointer hover:border-[var(--muted)]',
  choiceIco: 'w-[42px] h-[42px] rounded-xl bg-[var(--surface)] flex items-center justify-center text-[var(--accent)] flex-none',
  pill: (on: boolean) => `border rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition cursor-pointer ${on ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]' : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)]'}`,
  info: 'm-0 text-[14px] text-[var(--muted)] bg-[var(--bg)] rounded-xl p-3',
  h4: 'font-display font-semibold text-[16px] text-[var(--ink)] mt-4 mb-1',
};

/** The edit window that slides up from the bottom. Tap outside or press Esc to close. */
export function Sheet({ children, onClose = closeSheet }: { children: React.ReactNode; onClose?: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/45" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" className="w-full max-w-[480px] max-h-[92%] overflow-y-auto overflow-x-hidden bg-[var(--surface)] rounded-t-[24px] p-5 pb-[calc(32px+env(safe-area-inset-bottom,0px))] shadow-[var(--shadow)]">
        {children}
      </div>
    </div>
  );
}

/** Buttons at the bottom of an edit window. */
export function Actions({ onDelete, saveLabel = 'Save', cancel = true }: { onDelete?: () => void; saveLabel?: string; cancel?: boolean }) {
  return (
    <div className="flex items-center justify-end gap-2 mt-4 flex-wrap">
      {onDelete && <button type="button" onClick={onDelete} className={cls.danger + ' mr-auto'}>{t('Delete')}</button>}
      {cancel && <button type="button" onClick={closeSheet} className={cls.ghost}>{t('Cancel')}</button>}
      <button type="submit" className={cls.primary}>{t(saveLabel)}</button>
    </div>
  );
}

export function RemindSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cls.input}>
      {REMIND.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
    </select>
  );
}
