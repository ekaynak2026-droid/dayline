'use client';
// Reminders, installing to the home screen, and other things that depend on the phone.

import { app, emit, save, toast } from './store';
import { addDays, fmt, fromIso, iso, todayIso } from './dates';
import { asset } from './config';
import { t } from './i18n';

/* ---------- reminders ---------- */
/** Reminder choices; the labels go through t() where they are shown. */
export const REMIND: [string, string][] = [['', 'No reminder'], ['0', 'At the time'], ['10', '10 minutes before'], ['60', '1 hour before'], ['1440', '1 day before']];
type Remindable = { date: string; time: string; remind: string; rset?: number; id: string };
export const hasRemind = (x: { remind?: string }) => x.remind !== '' && x.remind != null;

function dueAt(x: Remindable) {
  const [h, m] = (x.time || '09:00').split(':').map(Number);
  const d = fromIso(x.date); d.setHours(h, m, 0, 0);
  return d.getTime() - +x.remind * 60000;
}
export function whenText(x: { date: string; time: string }) {
  const T = todayIso();
  const d = fromIso(x.date);
  const day = x.date === T ? t('Today') : x.date === iso(addDays(fromIso(T), 1)) ? t('Tomorrow') : fmt(d, { weekday: 'long', day: 'numeric', month: 'long' });
  return x.time ? t('{day} at {time}', { day, time: x.time }) : day;
}
async function notify(title: string, body: string) {
  toast(t('Reminder: {title}', { title }));
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const opts = { body, icon: asset('icons/icon-192.png'), badge: asset('icons/icon-192.png'), tag: title + body };
    if (reg) await reg.showNotification(title, opts); else new Notification(title, opts);
  } catch { /* the phone refused; the message above was still shown */ }
}
/** Runs every 30 seconds: shows reminders that are due. Each one fires once. */
export function checkReminders() {
  const S = app.S, now = Date.now();
  let changed = false;
  for (const x of [...S.tasks.filter((t) => !t.done), ...S.events] as (Remindable & { text?: string; title?: string })[]) {
    if (!hasRemind(x)) continue;
    const at = dueAt(x), key = x.id + '@' + at;
    // Not for times that had already passed when the reminder was set.
    if (now >= at && now - at < 12 * 3600e3 && at >= (x.rset || 0) - 60000 && !S.fired[key]) {
      S.fired[key] = now; changed = true; notify(x.text || x.title || '', whenText(x));
    }
  }
  for (const k in S.fired) if (now - S.fired[k] > 7 * 864e5) { delete S.fired[k]; changed = true; }
  if (changed) save();
}
export async function enableReminders() {
  if (!('Notification' in window)) { toast(isIOS() && !standalone() ? 'Add Dayline to your Home Screen first' : 'This browser cannot show reminders'); return; }
  const r = await Notification.requestPermission();
  toast(r === 'granted' ? 'Reminders are on' : 'Reminders are blocked. You can allow them in your phone settings.');
  emit();
}
/** After saving something with a reminder, a gentle hint if reminders are still off. */
export function remindHint(x: { remind?: string }) {
  if (hasRemind(x) && 'Notification' in window && Notification.permission === 'default') setTimeout(() => toast('Turn on reminders in Settings to get alerts'), 2300);
}
export function notificationState() {
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

/* ---------- home screen ---------- */
export const standalone = () => typeof window !== 'undefined' && (matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
export const isIOS = () => typeof navigator !== 'undefined' && (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

type InstallEvent = Event & { prompt: () => void; userChoice: Promise<unknown> };
let installPrompt: InstallEvent | null = null;
export const canInstall = () => !!installPrompt;
export function watchInstall() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e as InstallEvent; emit(); });
  window.addEventListener('appinstalled', () => { installPrompt = null; emit(); });
}
export async function runInstall() {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice.catch(() => {});
  installPrompt = null; emit();
}

/* ---------- adding events to the phone's own calendar (.ics file) ---------- */
const icsEsc = (s: string) => String(s).replace(/[\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
export function icsFor(ev: { id: string; title: string; date: string; time: string; remind: string }) {
  const dt = ev.date.replace(/-/g, '');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dayline//Planner//EN', 'BEGIN:VEVENT', 'UID:' + ev.id + '@dayline', 'DTSTAMP:' + utcStamp(new Date())];
  if (ev.time) L.push('DTSTART:' + dt + 'T' + ev.time.replace(':', '') + '00', 'DURATION:PT1H');
  else L.push('DTSTART;VALUE=DATE:' + dt, 'DTEND;VALUE=DATE:' + iso(addDays(fromIso(ev.date), 1)).replace(/-/g, ''));
  L.push('SUMMARY:' + icsEsc(ev.title));
  if (hasRemind(ev)) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(ev.title), 'TRIGGER:-PT' + +ev.remind + 'M', 'END:VALARM');
  L.push('END:VEVENT', 'END:VCALENDAR');
  return L.join('\r\n');
}
