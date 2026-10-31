'use client';
// The three file libraries in public/vendor (pdf.js, mammoth.js, SheetJS) are loaded only the first
// time they are needed: by the viewer, and by the task workbook (lib/workbook.ts).

import { asset } from './config';

const loaded: Record<string, Promise<unknown>> = {};
export const loadVendor = (src: string) => loaded[src] || (loaded[src] = new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = asset(src); s.onload = res;
  s.onerror = () => { delete loaded[src]; rej(new Error('load')); };
  document.head.append(s);
}));
