'use client';
// The app's frame: the three tabs, the + button, edit windows, the file viewer and start-up.

import React, { useEffect, useState } from 'react';
import type { TabType } from '@/types';
import { app, emit, loadState, toast, useApp } from '@/lib/store';
import { lockVault } from '@/lib/vault';
import { checkReminders, watchInstall } from '@/lib/device';
import { onSyncReady, startSync } from '@/lib/sync';
import { importFromOther } from '@/lib/import';
import { TEST } from '@/lib/config';
import { todayIso } from '@/lib/dates';
import { asset } from '@/lib/config';
import { Navigation } from '@/components/navigation';
import { TasksView, scrollToDay } from '@/components/tasks-view';
import { CalendarView } from '@/components/calendar-view';
import { getCalDay } from '@/lib/ui-state';
import { NotesView, newNoteChooser } from '@/components/notes-view';
import { editEvent, editTask } from '@/components/rows';
import { Viewer } from '@/components/viewer';
import { IconPlus } from '@/components/icons';

const TABS: TabType[] = ['tasks', 'calendar', 'notes'];
const tabFromHash = (): TabType => { const h = location.hash.slice(1) as TabType; return TABS.includes(h) ? h : 'tasks'; };

/* Main app only: anything entered in the test version (which ran at /dayline/test/) is brought in,
   once per device from this device, and once per device from the sync account after signing in. */
function flag(k: string) { try { return localStorage.getItem(k) === '1'; } catch { return false; } }
function setFlag(k: string) { try { localStorage.setItem(k, '1'); } catch { /* private mode */ } }
function keepTestVersionData() {
  if (!flag('dayline-merged-test-device')) {
    importFromOther({ device: true, online: false }).then(() => setFlag('dayline-merged-test-device')).catch(() => {});
  }
  onSyncReady(() => {
    if (flag('dayline-merged-test-online')) return;
    importFromOther({ device: false, online: true }).then((r) => { if (r.fromOnline) setFlag('dayline-merged-test-online'); }).catch(() => {});
  });
}

let started = false;
function startOnce() {
  if (started) return; started = true;
  (window as unknown as { __dayline: typeof app }).__dayline = app; // lets the automatic tests look inside
  loadState().then(({ copied }) => {
    if (copied) toast('Copied your tasks and notes from Dayline');
    if (!TEST) keepTestVersionData();
    checkReminders(); setInterval(checkReminders, 30000);
    startSync();
  });
  watchInstall();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register(asset('sw.js'), { scope: asset('') }).catch(() => {});
  // Locked notes lock again a minute after leaving the app. A new day starts fresh.
  let lockTimer: ReturnType<typeof setTimeout> | undefined;
  const day = todayIso();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) lockTimer = setTimeout(() => { if (app.vaultKey) { lockVault(); emit(); } }, 60000);
    else { clearTimeout(lockTimer); if (todayIso() !== day) location.reload(); else checkReminders(); }
  });
}

export default function Home() {
  const { loaded, sheet, toast: toastMsg } = useApp();
  // The first screen is a spinner, so reading the address here is safe.
  const [tab, setTabState] = useState<TabType>(() => (typeof window === 'undefined' ? 'tasks' : tabFromHash()));

  useEffect(() => {
    startOnce();
    const onHash = () => setTabState(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const setTab = (t: TabType) => { if (location.hash !== '#' + t) history.replaceState(null, '', '#' + t); setTabState(t); window.scrollTo(0, 0); };

  const fab = () => tab === 'tasks' ? editTask(null, todayIso()) : tab === 'calendar' ? editEvent(null, getCalDay() || todayIso()) : newNoteChooser();

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex justify-center">
      <div className="w-full max-w-[480px] min-h-screen relative flex flex-col bg-[var(--bg)] md:border-x md:border-[var(--line)] overflow-x-clip">
        <main className="flex-1">
          {tab === 'tasks' && <TasksView key="tasks" />}
          {tab === 'calendar' && <CalendarView key="cal" onSeeTasks={(k) => { setTab('tasks'); setTimeout(() => scrollToDay(k, true), 60); }} />}
          {tab === 'notes' && <NotesView key="notes" />}
        </main>

        <button onClick={fab} aria-label={tab === 'tasks' ? 'Add task' : tab === 'calendar' ? 'Add event' : 'New note'}
          className="fixed right-[max(18px,env(safe-area-inset-right,0px))] md:right-[calc(50%-222px)] bottom-[calc(78px+env(safe-area-inset-bottom,0px))] z-20 w-[58px] h-[58px] rounded-[20px] bg-[var(--accent)] text-[var(--accent-ink)] shadow-[var(--shadow)] flex items-center justify-center hover:opacity-95 active:scale-95 cursor-pointer">
          <IconPlus className="w-[26px] h-[26px]" />
        </button>

        {sheet}

        {toastMsg && (
          <div role="status" className="fixed left-1/2 bottom-[calc(140px+env(safe-area-inset-bottom,0px))] -translate-x-1/2 max-w-[90vw] bg-[var(--ink)] text-[var(--bg)] px-4 py-2.5 rounded-xl font-semibold text-sm z-50 shadow-[var(--shadow)] text-center">
            {toastMsg}
          </div>
        )}

        <Navigation currentTab={tab} onTabChange={setTab} />
        <Viewer />
      </div>
    </div>
  );
}
