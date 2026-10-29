// Small date helpers. Dates are stored as text "YYYY-MM-DD" in the phone's own time zone.

export const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromIso = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const todayDate = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
export const todayIso = () => iso(todayDate());
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-GB', o);
/** Sort by time; items without a time go last. */
export const byTime = (a: { time?: string }, b: { time?: string }) => {
  const x = a.time || '99', y = b.time || '99';
  return x < y ? -1 : x > y ? 1 : 0;
};
/** "Today", "Yesterday" or a short date, for when a note was last changed. */
export function ago(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const n = Math.round((todayDate().getTime() - d.getTime()) / 864e5);
  return n <= 0 ? 'Today' : n === 1 ? 'Yesterday' : fmt(d, { day: 'numeric', month: 'short' });
}
