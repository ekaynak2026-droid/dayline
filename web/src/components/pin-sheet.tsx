'use client';
// The 6-digit PIN pad for locked notes: set a PIN, unlock, or change it.

import React, { useEffect, useRef, useState } from 'react';
import { app, closeSheet, openSheet, toast } from '@/lib/store';
import { changePin, createVault, openVault } from '@/lib/vault';
import { Sheet, cls } from './ui';

const PINLEN = 6;
type Mode = 'set' | 'unlock' | 'change';

/** Opens locked notes, asking for a PIN (or to choose one) first if needed, then runs `then`. */
export function ensureVault(then?: () => void) {
  if (!app.S.vault) openSheet(<PinSheet key={'set' + Date.now()} mode="set" then={then} />);
  else if (!app.vaultKey) openSheet(<PinSheet key={'unlock' + Date.now()} mode="unlock" then={then} />);
  else then?.();
}

export function PinSheet({ mode, then }: { mode: Mode; then?: () => void }) {
  const setup = mode === 'set' || mode === 'change';
  const head0 = mode === 'change' ? 'Choose a new 6-digit PIN' : setup ? 'Choose a 6-digit PIN' : 'Enter your PIN';
  const sub0 = setup ? 'You will type it to open locked notes. If you forget it, those notes cannot be recovered.' : 'Locked notes stay encrypted until you enter it.';
  const [entry, setEntryState] = useState('');
  const entryRef = useRef('');
  const setEntry = (v: string) => { entryRef.current = v; setEntryState(v); };
  const [head, setHead] = useState(head0);
  const [sub, setSub] = useState(sub0);
  const [err, setErr] = useState('');
  const [shake, setShake] = useState(0);
  const first = useRef<string | null>(null);
  const busy = useRef(false);
  const padRef = useRef<HTMLDivElement>(null);

  const fail = (m: string) => { setErr(m); setShake((n) => n + 1); setEntry(''); };

  const press = async (k: string) => {
    if (busy.current) return;
    const cur = entryRef.current;
    if (k === '⌫') { setEntry(cur.slice(0, -1)); return; }
    if (cur.length >= PINLEN) return;
    const next = cur + k;
    setEntry(next); setErr('');
    if (next.length < PINLEN) return;
    if (setup && first.current === null) {
      first.current = next;
      entryRef.current = '';
      setTimeout(() => setEntryState(''), 150);
      setHead('Type it once more'); setSub('Just to be sure it is right.');
      return;
    }
    if (setup && next !== first.current) { first.current = null; setHead(head0); setSub(sub0); fail('Those did not match. Start again.'); return; }
    busy.current = true; setSub(setup ? 'Securing your notes…' : 'Checking…');
    try {
      if (setup) {
        if (mode === 'change') await changePin(next); else await createVault(next);
        closeSheet(); toast(mode === 'change' ? 'PIN changed' : 'PIN set. Locked notes are ready'); then?.();
      } else if (await openVault(next)) { closeSheet(); then?.(); }
      else { busy.current = false; setSub(sub0); fail('Wrong PIN. Try again.'); }
    } catch { busy.current = false; setSub(sub0); fail('Locked notes need a secure (https) connection.'); }
  };

  // Typing digits on a keyboard works too.
  const pressRef = useRef(press);
  useEffect(() => { pressRef.current = press; });
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (/^\d$/.test(e.key)) pressRef.current(e.key); else if (e.key === 'Backspace') pressRef.current('⌫'); };
    document.addEventListener('keydown', k);
    padRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => document.removeEventListener('keydown', k);
  }, []);

  return (
    <Sheet>
      <div className="grid justify-items-center text-center gap-2">
        <h3 className={cls.h3 + ' mb-0'}>{head}</h3>
        <p className="m-0 text-[14px] text-[var(--muted)] max-w-[34ch]">{sub}</p>
        <div key={shake} className={`flex gap-3 my-3 ${shake ? 'shake' : ''}`} aria-label={`${entry.length} of 6 digits`}>
          {Array.from({ length: PINLEN }).map((_, i) => (
            <i key={i} className={`w-3.5 h-3.5 rounded-full border-2 border-[var(--ink)] ${i < entry.length ? 'bg-[var(--ink)]' : ''}`} />
          ))}
        </div>
        {err && <p role="alert" className="m-0 text-[var(--danger)] font-semibold text-[14px]">{err}</p>}
        <div ref={padRef} className="grid grid-cols-3 gap-2.5 my-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => k === '' ? <span key={i} /> : (
            <button key={i} type="button" data-k={k} onClick={() => press(k)} aria-label={k === '⌫' ? 'Delete digit' : undefined}
              className="w-[72px] h-[58px] rounded-2xl bg-[var(--bg)] text-[22px] font-semibold text-[var(--ink)] cursor-pointer active:scale-95">{k}</button>
          ))}
        </div>
        <button type="button" onClick={closeSheet} className={cls.ghost}>Cancel</button>
      </div>
    </Sheet>
  );
}
