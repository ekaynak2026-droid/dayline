'use client';
// Settings: reminders, sync, backup and restore, locked-note PIN, installing.

import React, { useState } from 'react';
import type { State } from '@/types';
import { app, closeSheet, empty, idbSet, openSheet, save, toast, useApp } from '@/lib/store';
import { blobToB64, download, filesOf, getFile } from '@/lib/files';
import { lockVault, unb64 } from '@/lib/vault';
import { ago, fmt, iso } from '@/lib/dates';
import { canInstall, enableReminders, isIOS, notificationState, runInstall, standalone } from '@/lib/device';
import { createAccount, resetPassword, signIn, signOut, syncStatus } from '@/lib/sync';
import { TEST, VERSION } from '@/lib/config';
import { importFromMain, type ImportResult } from '@/lib/import';
import { ensureVault, PinSheet } from './pin-sheet';
import { InstallSteps } from './tasks-view';
import { IconLock, IconOpen, IconSave } from './icons';
import { Sheet, cls } from './ui';

export function openSettings() { openSheet(<SettingsSheet key={Date.now()} />); }

function agoText(t: number | null) {
  if (!t) return '';
  const sec = Math.round((Date.now() - t) / 1000);
  return sec < 60 ? 'just now' : sec < 3600 ? Math.round(sec / 60) + ' min ago' : new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function SyncPanel() {
  useApp();
  const s = syncStatus();
  const [email, setEmail] = useState(app.S.sync?.email || '');
  const [pass, setPass] = useState('');
  if (!s.configured) return <p className={cls.info}>Sync is not set up for this copy of Dayline yet.</p>;
  if (!s.booted) return <p className={cls.info}>{typeof navigator !== 'undefined' && navigator.onLine ? 'Connecting…' : 'Sync needs the internet the first time. Try again when you are online.'}</p>;
  if (s.signedIn) return (
    <div className="grid gap-1">
      <p className={cls.info}><b className="text-[var(--ink)]">Syncing as {s.email}.</b> {s.error ? s.error : s.ready ? (s.lastOk ? 'Last synced ' + agoText(s.lastOk) + '.' : 'Up to date.') : 'Getting your data…'} Sign in with the same email on your other devices to share everything.</p>
      <div><button type="button" onClick={async () => { await signOut(); toast('Signed out. Your data stays on this device.'); }} className={cls.link + ' py-2'}>Sign out on this device</button></div>
    </div>
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); signIn(email.trim(), pass); }} className="grid gap-1.5">
      <p className={cls.info}>Use the same email and password on your phone and computer, and everything stays the same on both.</p>
      <label htmlFor="sy-email" className={cls.label}>Email</label>
      <input id="sy-email" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={cls.input} />
      <label htmlFor="sy-pass" className={cls.label}>Password</label>
      <input id="sy-pass" type="password" autoComplete="current-password" minLength={6} value={pass} onChange={(e) => setPass(e.target.value)} className={cls.input} />
      {s.error && <p role="alert" className="m-0 text-[var(--danger)] text-[14px] font-semibold">{s.error}</p>}
      <div className="flex gap-2 flex-wrap mt-1.5">
        <button type="submit" className={cls.primary}>Sign in</button>
        <button type="button" onClick={() => createAccount(email.trim(), pass).then(() => { if (syncStatus().signedIn) toast('Account created. Syncing…'); })} className={cls.ghost + ' text-[var(--accent)]'}>Create account</button>
        <button type="button" onClick={() => resetPassword(email.trim()).then(() => { if (!syncStatus().error) toast('Password reset email sent'); })} className={cls.ghost}>Forgot password</button>
      </div>
    </form>
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
    try { const r = await importFromMain(); setRes(r); toast('Copied from Dayline'); }
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
  const remindState = perm === 'granted' ? <b>Reminders are on.</b>
    : perm === 'denied' ? <><b>Reminders are blocked.</b> Allow notifications for Dayline in your phone settings.</>
    : isIOS() && !standalone() ? 'On iPhone, add Dayline to your Home Screen first, then turn reminders on here.'
    : perm === 'unsupported' ? 'This browser cannot show reminders.' : 'Reminders are off.';

  const backup = async () => {
    app.S.lastBackup = Date.now(); await save(); toast('Preparing backup…');
    const files: Record<string, { name: string; type: string; size: number; data: string }> = {}, missing: string[] = [];
    for (const n of [...S.notes, ...S.tasks, ...S.events]) for (const f of filesOf(n)) {
      const rec = await getFile(f.id);
      if (rec) files[f.id] = { name: rec.name, type: rec.type, size: rec.size, data: await blobToB64(rec.blob) }; else missing.push(f.name);
    }
    download(`dayline-backup-${iso(new Date())}.json`, JSON.stringify({ app: 'dayline', saved: new Date().toISOString(), state: app.S, files }), 'application/json');
    toast(missing.length ? `Backup saved, but ${missing.length} file(s) were not on this device` : 'Backup file saved');
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
      <h3 className={cls.h3}>Settings</h3>
      <div className="grid gap-2">
        {TEST && <CopyFromMain />}

        <h4 className={cls.h4}>Reminders</h4>
        <p className={cls.info}>{remindState} Reminders pop up when Dayline is open or running in the background. For events you must not miss, use &quot;Also add to my phone&apos;s calendar&quot; on the event.</p>
        {perm === 'default' && <div><button type="button" onClick={enableReminders} className={cls.primary}>Turn on reminders</button></div>}

        <h4 className={cls.h4}>Sync between devices</h4>
        <SyncPanel />

        <h4 className={cls.h4}>Backup</h4>
        <p className={cls.info}>{S.sync?.uid ? 'Your data is also kept in your sync account.' : 'Everything is stored only on this device.'} Save a backup file now and then, for example to iCloud Drive or Google Drive. {S.lastBackup ? `Last backup: ${ago(S.lastBackup)}.` : 'You have not made a backup yet.'}</p>
        <button type="button" onClick={backup} className={cls.choice}>
          <span className={cls.choiceIco}><IconSave className="w-5 h-5" /></span>
          <span><b className="block text-[var(--ink)] text-[15px]">Save a backup file</b><span className="text-[13.5px] text-[var(--muted)]">Includes attached files. Locked notes stay encrypted inside it</span></span>
        </button>
        <label htmlFor="st-file" className={cls.choice}>
          <span className={cls.choiceIco}><IconOpen /></span>
          <span><b className="block text-[var(--ink)] text-[15px]">Restore from a backup file</b><span className="text-[13.5px] text-[var(--muted)]">Replaces what is on this phone</span></span>
        </label>
        <input type="file" id="st-file" accept="application/json,.json" hidden onChange={pickRestore} />

        <h4 className={cls.h4}>Locked notes</h4>
        {S.vault ? (
          <>
            <button type="button" onClick={() => ensureVault(() => openSheet(<PinSheet key={'chg' + Date.now()} mode="change" />))} className={cls.choice}>
              <span className={cls.choiceIco}><IconLock /></span>
              <span><b className="block text-[var(--ink)] text-[15px]">Change my PIN</b><span className="text-[13.5px] text-[var(--muted)]">You will need your current PIN first</span></span>
            </button>
            <div><button type="button" onClick={() => openSheet(<ForgotPin key={Date.now()} />)} className={cls.danger + ' pl-0'}>I forgot my PIN</button></div>
          </>
        ) : <p className={cls.info}>Not set up yet. Open the Notes tab to start.</p>}

        {!standalone() && (
          <>
            <h4 className={cls.h4}>Install</h4>
            <div className={cls.info}><InstallSteps /></div>
            {canInstall() && <div><button type="button" onClick={runInstall} className={cls.primary}>Install Dayline</button></div>}
          </>
        )}
        <p className="text-[12.5px] text-[var(--muted)] mt-2">Dayline {VERSION}</p>
        <div className="flex justify-end"><button type="button" onClick={closeSheet} className={cls.primary}>Done</button></div>
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
      <h3 className={cls.h3}>Restore this backup?</h3>
      <div className="bg-[var(--sun-soft)] text-[var(--sun-ink)] rounded-xl p-3 text-[14px]">
        This replaces all tasks, events and notes on this phone with the backup{saved ? ` from ${fmt(new Date(saved), { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}: {st.tasks.length} tasks, {st.events.length} events, {st.notes.length + (st.vault?.count || 0)} notes.
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" onClick={closeSheet} className={cls.ghost}>Cancel</button>
        <button type="button" onClick={go} className={cls.primary}>Restore</button>
      </div>
    </Sheet>
  );
}

function ForgotPin() {
  const go = async () => { app.S.vault = null; lockVault(); await save(); closeSheet(); toast('Locked notes deleted'); };
  return (
    <Sheet>
      <h3 className={cls.h3}>Forgot your PIN?</h3>
      <div className="bg-[var(--sun-soft)] text-[var(--sun-ink)] rounded-xl p-3 text-[14px]">
        Locked notes are encrypted with your PIN, so without it they cannot be opened by anyone. If you restore an older backup, use the PIN you had then. The only other option is to delete the {app.S.vault?.count || 0} locked notes and choose a new PIN.
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" onClick={closeSheet} className={cls.ghost}>Keep them</button>
        <button type="button" onClick={go} className={cls.primary + ' !bg-[var(--danger)]'}>Delete locked notes</button>
      </div>
    </Sheet>
  );
}
