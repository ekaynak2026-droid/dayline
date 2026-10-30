'use client';
/* In-app viewer: shows attached files on screen, without downloading them.
   PDF uses pdf.js (Mozilla), Word uses mammoth.js, Excel uses SheetJS. The three libraries live in
   the vendor/ folder and are only loaded the first time a file of that kind is opened. */

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef } from 'react';
import { app, emit, useApp } from '@/lib/store';
import { showBlob } from '@/lib/files';
import { asset } from '@/lib/config';
import { t } from '@/lib/i18n';

const loaded: Record<string, Promise<unknown>> = {};
const load = (src: string) => loaded[src] || (loaded[src] = new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = asset(src); s.onload = res;
  s.onerror = () => { delete loaded[src]; rej(new Error('load')); };
  document.head.append(s);
}));
const ext = (n: string) => (String(n).split('.').pop() || '').toLowerCase();
const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// Word and Excel files are turned into web page code; keep only harmless parts of it.
function clean(html: string) {
  const d = new DOMParser().parseFromString(html, 'text/html');
  d.querySelectorAll('script,style,iframe,object,embed,link,meta,form,base').forEach((x) => x.remove());
  d.querySelectorAll('*').forEach((x) => {
    for (const a of Array.from(x.attributes)) {
      const n = a.name.toLowerCase(), v = a.value.trim().toLowerCase();
      if (n.startsWith('on') || (n === 'style' && /url\(/.test(v))) x.removeAttribute(a.name);
      else if ((n === 'href' || n === 'src') && !(/^https?:/.test(v) || v.startsWith('#') || (n === 'src' && v.startsWith('data:image/')))) x.removeAttribute(a.name);
    }
    if (x.tagName === 'A') { (x as HTMLAnchorElement).target = '_blank'; (x as HTMLAnchorElement).rel = 'noopener'; }
  });
  return d.body.innerHTML;
}

let gen = 0;
async function renderPdf(body: HTMLElement, blob: Blob, my: number) {
  await load('vendor/pdf.min.js');
  const pdfjsLib = (window as any).pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc = asset('vendor/pdf.worker.min.js');
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  body.innerHTML = `<p class="vmsg">${doc.numPages === 1 ? t('1 page') : t('{n} pages', { n: doc.numPages })}</p>`;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  for (let i = 1; i <= doc.numPages; i++) {
    if (my !== gen) return;
    const page = await doc.getPage(i), base = page.getViewport({ scale: 1 });
    const w = Math.min(body.clientWidth - 24, 900), vp = page.getViewport({ scale: (w / base.width) * dpr });
    const c = document.createElement('canvas'); c.className = 'vpage'; c.width = vp.width; c.height = vp.height; c.style.width = w + 'px'; c.setAttribute('aria-label', 'Page ' + i);
    body.append(c);
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  }
}
async function renderWord(body: HTMLElement, blob: Blob) {
  await load('vendor/mammoth.browser.min.js');
  const r = await (window as any).mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
  body.innerHTML = `<article class="vdoc">${clean(r.value) || `<p>${t('This document is empty.')}</p>`}</article>`;
}
async function renderSheet(body: HTMLElement, blob: Blob) {
  await load('vendor/xlsx.full.min.js');
  const XLSX = (window as any).XLSX;
  const wb = XLSX.read(new Uint8Array(await blob.arrayBuffer()), { type: 'array' });
  const pill = 'border rounded-full px-3.5 py-1.5 text-sm font-semibold cursor-pointer';
  const tabs = wb.SheetNames.length > 1 ? `<div class="vtabs flex gap-2 overflow-x-auto">${wb.SheetNames.map((n: string, i: number) => `<button class="${pill}" data-sheet="${i}">${esc(n)}</button>`).join('')}</div>` : '';
  body.innerHTML = `${tabs}<div class="vsheet"></div>`;
  const show = (i: number) => {
    body.querySelector('.vsheet')!.innerHTML = clean(XLSX.utils.sheet_to_html(wb.Sheets[wb.SheetNames[i]], { header: '', footer: '' }));
    body.querySelectorAll<HTMLElement>('[data-sheet]').forEach((b) => {
      const on = +b.dataset.sheet! === i;
      b.style.background = on ? 'var(--ink)' : 'var(--surface)'; b.style.color = on ? 'var(--bg)' : 'var(--ink)'; b.style.borderColor = on ? 'var(--ink)' : 'var(--line)';
    });
  };
  body.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-sheet]'); if (b) show(+b.dataset.sheet!); });
  show(0);
}

export function closeViewer() { gen++; app.viewer = null; emit(); }

export function Viewer() {
  const { viewer } = useApp();
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!viewer || !bodyRef.current) return;
    const body = bodyRef.current, my = ++gen, { blob, name, type } = viewer, e = ext(name);
    body.innerHTML = `<p class="vmsg">${t('Opening…')}</p>`;
    closeRef.current?.focus();
    let url = '';
    (async () => {
      try {
        if (type === 'application/pdf' || e === 'pdf') await renderPdf(body, blob, my);
        else if (e === 'docx') await renderWord(body, blob);
        else if (['xlsx', 'xls', 'xlsm', 'csv', 'ods'].includes(e)) await renderSheet(body, blob);
        else if (e === 'txt' || String(type).startsWith('text/')) body.innerHTML = `<pre class="vdoc vtext">${esc(await blob.text())}</pre>`;
        else if (String(type).startsWith('image/') || /\.(jpe?g|png|gif|webp)$/i.test(name)) { url = URL.createObjectURL(blob); body.innerHTML = `<img class="vpage" src="${url}" alt="${esc(name)}">`; }
        else body.innerHTML = `<p class="vmsg">${esc(t("This kind of file ({ext}) can't be shown inside Dayline.", { ext: e.toUpperCase() || '?' }))}${e === 'doc' ? ' ' + t('Older Word files (.doc) need Word; files saved as .docx open here.') : ''} ${t('Tap Download to open it in another app.')}</p>`;
      } catch (err) {
        if (my !== gen) return;
        body.innerHTML = `<p class="vmsg">${t((err as Error).message === 'load' ? 'The viewer could not load. Connect to the internet once and try again.' : 'Dayline could not read this file. It may be damaged or password-protected.')} ${t('You can still tap Download.')}</p>`;
      }
    })();
    const k = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { ev.stopPropagation(); closeViewer(); } };
    document.addEventListener('keydown', k, true);
    return () => { document.removeEventListener('keydown', k, true); if (url) URL.revokeObjectURL(url); };
  }, [viewer]);

  if (!viewer) return null;
  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={viewer.name}>
      <header className="vbar">
        <button ref={closeRef} type="button" onClick={closeViewer} aria-label={t('Close')} className="w-[38px] h-[38px] rounded-xl flex items-center justify-center border border-[var(--line)] bg-[var(--surface)] text-[24px] leading-none flex-none cursor-pointer">×</button>
        <b className="vname">{viewer.name}</b>
        <button type="button" onClick={() => showBlob(viewer.blob, viewer.name)} className="flex-none text-[var(--accent)] font-bold py-2 px-1.5 cursor-pointer">{t('Download')}</button>
      </header>
      <div ref={bodyRef} className="vbody" />
    </div>
  );
}
