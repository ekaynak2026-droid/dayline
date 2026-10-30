'use client';
// Settings: reminders, sync, backup and restore, locked-note PIN, the optional AI assistant, installing.

import React, { useState } from 'react';
import type { State } from '@/types';
import { app, closeSheet, empty, idbSet, openSheet, save, toast, useApp } from '@/lib/store';
import { blobToB64, download, filesOf, getFile } from '@/lib/files';
import { lockVault, unb64 } from '@/lib/vault';
import { ago, fmt, iso } from '@/lib/dates';
import { canInstall, enableReminders, isIOS, notificationState, runInstall, standalone } from '@/lib/device';
import { createAccount, resetPassword, signIn, signOut, syncStatus } from '@/lib/sync';
import { TEST, VERSION } from '@/lib/config';
import { importFromOther, type ImportResult } from '@/lib/import';
import { getLang, setLang, t, locale, type Lang } from '@/lib/i18n';
import { emit } from '@/lib/store';
import { ensureVault, PinSheet } from './pin-sheet';
import { InstallSteps } from './tasks-view';
import { IconLock, IconOpen, IconSave } from './icons';
import { Sheet, cls } from './ui';
import { ai, aiEnabled, downloadSize, pauseDownload, removeAi, startAi, webgpuOk } from '@/lib/ai';
import { sizeText } from '@/lib/files';

export function openSettings() { openSheet(<SettingsSheet key={Date.now()} />); }

function agoText(ts: number | null) {
  if (!ts) return '';
  const sec = Math.round((Date.now() - ts) / 1000);
  return sec < 60 ? t('just now') : sec < 3600 ? t('{n} min ago', { n: Math.round(sec / 60) }) : new Date(ts).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
}

function SyncPanel() {
  useApp();
  const s = syncStatus();
  const [email, setEmail] = useState(app.S.sync?.email || '');
  const [pass, setPass] = useState('');
  if (!s.configured) return <p className={cls.info}>{t('Sync is not set up for this copy of Dayline yet.')}</p>;
  if (!s.booted) return <p className={cls.info}>{typeof navigator !== 'undefined' && navigator.onLine ? t('Connecting…') : t('Sync needs the internet the first time. Try again when you are online.')}</p>;
  if (s.signedIn) return (
    <div className="grid gap-1">
      <p className={cls.info}><b className="text-[var(--ink)]">{t('Syncing as {email}.', { email: s.email || '' })}</b> {s.error ? s.error : s.ready ? (s.lastOk ? t('Last synced {ago}.', { ago: agoText(s.lastOk) }) : t('Up to date.')) : t('Getting your data…')} {t('Sign in with the same email on your other devices to share everything.')}</p>
      <div><button type="button" onClick={async () => { await signOut(); toast('Signed out. Your data stays on this device.'); }} className={cls.link + ' py-2'}>{t('Sign out on this device')}</button></div>
    </div>
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); signIn(email.trim(), pass); }} className="grid gap-1.5">
      <p className={cls.info}>{t('Use the same email and password on your phone and computer, and everything stays the same on both.')}</p>
      <label htmlFor="sy-email" className={cls.label}>{t('Email')}</label>
      <input id="sy-email" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={cls.input} />
      <label htmlFor="sy-pass" className={cls.label}>{t('Password')}</label>
      <input id="sy-pass" type="password" autoComplete="current-password" minLength={6} value={pass} onChange={(e) => setPass(e.target.value)} className={cls.input} />
      {s.error && <p role="alert" className="m-0 text-[var(--danger)] text-[14px] font-semibold">{s.error}</p>}
      <div className="flex gap-2 flex-wrap mt-1.5">
        <button type="submit" className={cls.primary}>{t('Sign in')}</button>
        <button type="button" onClick={() => createAccount(email.trim(), pass).then(() => { if (syncStatus().signedIn) toast('Account created. Syncing…'); })} className={cls.ghost + ' text-[var(--accent)]'}>{t('Create account')}</button>
        <button type="button" onClick={() => resetPassword(email.trim()).then(() => { if (!syncStatus().error) toast('Password reset email sent'); })} className={cls.ghost}>{t('Forgot password')}</button>
      </div>
    </form>
  );
}

/** The optional on-phone AI assistant (Gemma 4 E2B). */
function AiPanel() {
  useApp();
  const [step, setStep] = useState<'idle' | 'checking' | 'confirm' | 'nogpu' | 'remove'>('idle');
  const on = aiEnabled();
  const check = async () => {
    setStep('checking');
    if (!(await webgpuOk())) { setStep('nogpu'); return; }
    await downloadSize();
    setStep('confirm');
  };
  const sizeLabel = ai.size ? sizeText(ai.size) : t('about 1.5–2 GB');
  const intro = <p className={cls.info}>{t('Adds an assistant to the Helper tab: chat about your tasks and get smarter advice for each one. It runs on this phone (Google Gemma 4 E2B), so after the one-time download it works offline and nothing you write leaves the phone.')}</p>;

  if (ai.status === 'downloading' || ai.status === 'loading') return (
    <div className="grid gap-2">
      {intro}
      <div className="grid gap-1.5" role="status">
        <div className="flex justify-between gap-2 text-[14px] font-semibold text-[var(--ink)]">
          <span>{t(ai.status === 'downloading' ? 'Downloading the AI model…' : 'Starting the AI model…')}</span>
          <span className="tabular-nums">{ai.status === 'downloading' && ai.size ? `${sizeText(ai.done)} / ${sizeText(ai.size)}` : `${ai.progress}%`}</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--line)] overflow-hidden"><div className="h-full bg-[var(--accent)] transition-[width]" style={{ width: `${ai.progress}%` }} /></div>
        {ai.note && <p className="m-0 text-[13px] font-semibold text-[var(--sun-ink)]">{t(ai.note)}</p>}
        <p className="m-0 text-[13px] text-[var(--muted)]">{t(ai.status === 'downloading'
          ? 'Keep Dayline open with the screen on, on Wi-Fi. It downloads in small parts: if it stops, tap Download again and it continues from the last finished part.'
          : 'Preparing the model on this phone. This can take a minute.')}</p>
        {ai.status === 'downloading' && <div><button type="button" onClick={pauseDownload} className={cls.ghost + ' pl-0'}>{t('Pause')}</button></div>}
      </div>
    </div>
  );
  if (ai.status === 'error' && !on) return (
    <div className="grid gap-2">
      {intro}
      <p role="alert" className="m-0 text-[var(--danger)] text-[14px] font-semibold">{t(ai.error)}</p>
      {ai.size > 0 && ai.done > 0 && <p className="m-0 text-[13px] text-[var(--muted)]">{t('{done} of {size} already downloaded.', { done: sizeText(ai.done), size: sizeText(ai.size) })}</p>}
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => startAi()} className={cls.primary}>{t('Download (continue)')}</button>
        <button type="button" onClick={async () => { await removeAi(); toast('Download removed'); }} className={cls.ghost}>{t('Cancel and delete the download')}</button>
      </div>
    </div>
  );
  if (on && ai.status !== 'error') return (
    <div className="grid gap-2">
      <p className={cls.info}><b className="text-[var(--ink)]">{t('The AI assistant is on.')}</b> {t('Open the Helper tab and choose Assistant. It is stored on this phone and works offline.')}</p>
      {step !== 'remove'
        ? <div><button type="button" onClick={() => setStep('remove')} className={cls.danger + ' pl-0'}>{t('Turn off and remove the model')}</button></div>
        : <div className="flex flex-wrap gap-2 items-center text-[14px]"><span className="text-[var(--ink)]">{t('This frees the space it uses. You can download it again later.')}</span>
            <button type="button" onClick={async () => { await removeAi(); setStep('idle'); toast('AI assistant removed'); }} className={cls.primary + ' !bg-[var(--danger)]'}>{t('Remove')}</button>
            <button type="button" onClick={() => setStep('idle')} className={cls.ghost}>{t('Cancel')}</button></div>}
    </div>
  );
  return (
    <div className="grid gap-2">
      {intro}
      {step === 'nogpu' || ai.status === 'unsupported'
        ? <p className={cls.info}><b className="text-[var(--ink)]">{t('This browser cannot run the AI model.')}</b> {t('It needs WebGPU: use Chrome on Android, or Safari on iPhone with iOS 26 or later.')}</p>
        : step === 'confirm'
          ? <div className="grid gap-2 bg-[var(--sun-soft)] text-[var(--sun-ink)] rounded-xl p-3 text-[14px]">
              <p className="m-0">{t('The download is {size}. Use Wi-Fi, and make sure the phone has that much free space. Phones with 6 GB of memory or more work best.', { size: sizeLabel })}</p>
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={() => { setStep('idle'); startAi(); }} className={cls.primary}>{t('Download ({size})', { size: sizeLabel })}</button>
                <button type="button" onClick={() => setStep('idle')} className={cls.ghost}>{t('Not now')}</button>
              </div>
            </div>
          : <div><button type="button" disabled={step === 'checking'} onClick={check} className={cls.primary}>{t(step === 'checking' ? 'Checking this phone…' : 'Set up the AI assistant')}</button></div>}
    </div>
  );
}

/** Test copy only: brings in everything from the main Dayline app. */
function CopyFromMain() {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ImportResult | null>(null);
  const [err, setErr] = useState('');
  const signedIn = syncStatus().signedIn;
  const go = async () => {
    setBusy(true); setErr(''); setRes(null);
    try { const r = await importFromOther(); setRes(r); toast('Copied from Dayline'); }
    catch { setErr('Something went wrong while copying. Check the internet connection and try again.'); }
    setBusy(false);
  };
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  return (
    <div className="grid gap-2 bg-[var(--sun-soft)] text-[var(--sun-ink)] rounded-xl p-3 text-[14px]">
      <p className="m-0"><b>This is the test version.</b> It keeps its own copy of your data, so nothing you do here changes your main Dayline app.</p>
      <p className="m-0">Tap below to bring in all your tasks, events, notes, files and locked notes from Dayline. {signedIn ? 'This includes everything synced from your other devices.' : 'Sign in under "Sync between devices" first to also bring in what is on your other devices.'} Locked notes keep the same PIN.</p>
      <div><button type="button" disabled={busy} onClick={go} className={cls.primary}>{busy ? 'Copying…' : 'Copy my Dayline data'}</button></div>
      {res && (
        <p role="status" className="m-0">
          {!res.fromDevice && !res.fromOnline ? 'No Dayline data was found on this device. Sign in to sync first, then try again.'
            : <>Copied {plural(res.tasks, 'task')}, {plural(res.events, 'event')}, {plural(res.notes, 'note')} and {plural(res.files, 'file')}{res.locked ? ', plus your locked notes' : ''}.{res.missingFiles ? ` ${plural(res.missingFiles, 'file')} could not be found; open the main Dayline on the device that has them, let it sync, then copy again.` : ''}</>}
        </p>
      )}
      {err && <p role="alert" className="m-0 text-[var(--danger)] font-semibold">{err}</p>}
    </div>
  );
}

function SettingsSheet() {
  const { S } = useApp();
  const perm = notificationState();
  const remindState = perm === 'granted' ? <b>{t('Reminders are on.')}</b>
    : perm === 'denied' ? <><b>{t('Reminders are blocked.')}</b> {t('Allow notifications for Dayline in your phone settings.')}</>
    : t(isIOS() && !standalone() ? 'On iPhone, add Dayline to your Home Screen first, then turn reminders on here.'
    : perm === 'unsupported' ? 'This browser cannot show reminders.' : 'Reminders are off.');

  const backup = async () => {
    app.S.lastBackup = Date.now(); await save(); toast('Preparing backup…');
    const files: Record<string, { name: string; type: string; size: number; data: string }> = {}, missing: string[] = [];
    for (const n of [...S.notes, ...S.tasks, ...S.events]) for (const f of filesOf(n)) {
      const rec = await getFile(f.id);
      if (rec) files[f.id] = { name: rec.name, type: rec.type, size: rec.size, data: await blobToB64(rec.blob) }; else missing.push(f.name);
    }
    download(`dayline-backup-${iso(new Date())}.json`, JSON.stringify({ app: 'dayline', saved: new Date().toISOString(), state: app.S, files }), 'application/json');
    toast(missing.length ? t('Backup saved, but {n} file(s) were not on this device', { n: missing.length }) : 'Backup file saved');
  };
  const pickRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(String(r.result)), st = d.state || d;
        if (!Array.isArray(st.tasks) || !Array.isArray(st.events) || !Array.isArray(st.notes)) throw 0;
        openSheet(<RestoreSheet key={Date.now()} st={st} saved={d.saved} files={d.files || {}} />);
      } catch { toast('That is not a Dayline backup file'); }
    };
    r.readAsText(f);
  };

  return (
    <Sheet>
      <h3 className={cls.h3}>{t('Settings')}</h3>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[14px] text-[var(--muted)] mr-1">{t('Language')}</span>
        {([['en', 'English'], ['ru', 'Русский']] as [Lang, string][]).map(([l, name]) => (
          <button key={l} type="button" onClick={() => { setLang(l); emit(); }} aria-pressed={getLang() === l} className={cls.pill(getLang() === l)}>{name}</button>
        ))}
      </div>
      <div className="grid gap-2">
        {TEST && <CopyFromMain />}

        <h4 className={cls.h4}>{t('Reminders')}</h4>
        <p className={cls.info}>{remindState} {t('Reminders pop up when Dayline is open or running in the background. For events you must not miss, use "Also add to my phone\'s calendar" on the event.')}</p>
        {perm === 'default' && <div><button type="button" onClick={enableReminders} className={cls.primary}>{t('Turn on reminders')}</button></div>}

        <h4 className={cls.h4}>{t('Sync between devices')}</h4>
        <SyncPanel />

        <h4 className={cls.h4}>{t('AI assistant (optional)')}</h4>
        <AiPanel />

        <h4 className={cls.h4}>{t('Backup')}</h4>
        <p className={cls.info}>{t(S.sync?.uid ? 'Your data is also kept in your sync account.' : 'Everything is stored only on this device.')} {t('Save a backup file now and then, for example to iCloud Drive or Google Drive.')} {S.lastBackup ? t('Last backup: {ago}.', { ago: ago(S.lastBackup) }) : t('You have not made a backup yet.')}</p>
        <button type="button" onClick={backup} className={cls.choice}>
          <span className={cls.choiceIco}><IconSave className="w-5 h-5" /></span>
          <span><b className="block text-[var(--ink)] text-[15px]">{t('Save a backup file')}</b><span className="text-[13.5px] text-[var(--muted)]">{t('Includes attached files. Locked notes stay encrypted inside it')}</span></span>
        </button>
        <label htmlFor="st-file" className={cls.choice}>
          <span className={cls.choiceIco}><IconOpen /></span>
          <span><b className="block text-[var(--ink)] text-[15px]">{t('Restore from a backup file')}</b><span className="text-[13.5px] text-[var(--muted)]">{t('Replaces what is on this phone')}</span></span>
        </label>
        <input type="file" id="st-file" accept="application/json,.json" hidden onChange={pickRestore} />

        <h4 className={cls.h4}>{t('Locked notes')}</h4>
        {S.vault ? (
          <>
            <button type="button" onClick={() => ensureVault(() => openSheet(<PinSheet key={'chg' + Date.now()} mode="change" />))} className={cls.choice}>
              <span className={cls.choiceIco}><IconLock /></span>
              <span><b className="block text-[var(--ink)] text-[15px]">{t('Change my PIN')}</b><span className="text-[13.5px] text-[var(--muted)]">{t('You will need your current PIN first')}</span></span>
            </button>
            <div><button type="button" onClick={() => openSheet(<ForgotPin key={Date.now()} />)} className={cls.danger + ' pl-0'}>{t('I forgot my PIN')}</button></div>
          </>
        ) : <p className={cls.info}>{t('Not set up yet. Open the Notes tab to start.')}</p>}

        {!standalone() && (
          <>
            <h4 className={cls.h4}>{t('Install')}</h4>
            <div className={cls.info}><InstallSteps /></div>
            {canInstall() && <div><button type="button" onClick={runInstall} className={cls.primary}>{t('Install Dayline')}</button></div>}
          </>
        )}
        <p className="text-[12.5px] text-[var(--muted)] mt-2">Dayline {VERSION}</p>
        <div className="flex justify-end"><button type="button" onClick={closeSheet} className={cls.primary}>{t('Done')}</button></div>
      </div>
    </Sheet>
  );
}

function RestoreSheet({ st, saved, files }: { st: State; saved?: string; files: Record<string, { name: string; type: string; size: number; data: string }> }) {
  const go = async () => {
    app.S = { ...empty(), ...st, sync: app.S.sync }; lockVault();
    for (const [id, f] of Object.entries(files)) await idbSet('file:' + id, { name: f.name, type: f.type, size: f.size, blob: new Blob([unb64(f.data) as BlobPart], { type: f.type }) });
    await save(); closeSheet(); toast('Backup restored');
  };
  return (
    <Sheet>
      <h3 className={cls.h3}>{t('Restore this backup?')}</h3>
      <div className="bg-[var(--sun-soft)] text-[var(--sun-ink)] rounded-xl p-3 text-[14px]">
        {t('This replaces all tasks, events and notes on this phone with the backup{from}: {t} tasks, {e} events, {n} notes.', { from: saved ? t(' from {date}', { date: fmt(new Date(saved), { day: 'numeric', month: 'long', year: 'numeric' }) }) : '', t: st.tasks.length, e: st.events.length, n: st.notes.length + (st.vault?.count || 0) })}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" onClick={closeSheet} className={cls.ghost}>{t('Cancel')}</button>
        <button type="button" onClick={go} className={cls.primary}>{t('Restore')}</button>
      </div>
    </Sheet>
  );
}

function ForgotPin() {
  const go = async () => { app.S.vault = null; lockVault(); await save(); closeSheet(); toast('Locked notes deleted'); };
  return (
    <Sheet>
      <h3 className={cls.h3}>{t('Forgot your PIN?')}</h3>
      <div className="bg-[var(--sun-soft)] text-[var(--sun-ink)] rounded-xl p-3 text-[14px]">
        {t('Locked notes are encrypted with your PIN, so without it they cannot be opened by anyone. If you restore an older backup, use the PIN you had then. The only other option is to delete the {n} locked notes and choose a new PIN.', { n: app.S.vault?.count || 0 })}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" onClick={closeSheet} className={cls.ghost}>{t('Keep them')}</button>
        <button type="button" onClick={go} className={cls.primary + ' !bg-[var(--danger)]'}>{t('Delete locked notes')}</button>
      </div>
    </Sheet>
  );
}
