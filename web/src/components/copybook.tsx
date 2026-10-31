'use client';
// The copybook in the Notes tab: sketches saved with "Save page" on the sketch pad, bound like a
// paper notebook. It starts closed; tap the cover to open it, then turn the pages with the arrows,
// a swipe, a tap on the page's edge or the arrow keys. Each page is a note marked book: 'copybook',
// so pages are saved and synced like any other note.

import React, { useRef, useState } from 'react';
import type { Note } from '@/types';
import { app, save, toast } from '@/lib/store';
import { viewBlob } from '@/lib/files';
import { fmt } from '@/lib/dates';
import { t } from '@/lib/i18n';
import { cls } from './ui';

const TURN_MS = 700;
const COVER = '#1F3A68';
const PAPER_BACK = 'linear-gradient(90deg, #EFEBE1 0%, #FBF9F4 12%, #FBF9F4 100%)';

export const isPage = (n: Note) => n.book === 'copybook';

async function dataUrlBlob(url: string) { return (await fetch(url)).blob(); }

function Cover({ count }: { count: number }) {
  return (
    <div className="absolute inset-0 rounded-r-[14px] rounded-l-[4px] overflow-hidden" style={{
      backgroundColor: COVER,
      backgroundImage: 'radial-gradient(rgba(255,255,255,.06) 1px, transparent 1.2px), linear-gradient(135deg, rgba(255,255,255,.10), rgba(0,0,0,.18))',
      backgroundSize: '6px 6px, 100% 100%',
    }}>
      {/* spine with stitches */}
      <div className="absolute inset-y-0 left-0 w-[9%]" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,.35), rgba(0,0,0,.12))' }}>
        <div className="absolute inset-y-3 right-[22%] border-r-2 border-dashed border-white/25" />
      </div>
      {/* elastic band */}
      <div className="absolute inset-y-0 right-[9%] w-[5%] bg-[#0E1A30] shadow-[0_0_4px_rgba(0,0,0,.4)]" />
      {/* label */}
      <div className="absolute left-[20%] right-[22%] top-[16%] bg-[#FBF9F4] rounded-lg px-3 py-3 text-center shadow-[0_2px_6px_rgba(0,0,0,.3)]">
        <div className="font-display font-extrabold text-[clamp(18px,6vw,28px)] leading-none text-[#14212B]">{t('Copybook')}</div>
        <div className="mt-1.5 h-px bg-[#C9D3DC]" />
        <div className="mt-1.5 text-[13px] text-[#5D6B77]">{t('Sketches')} · {count === 1 ? t('1 page') : t('{n} pages', { n: count })}</div>
      </div>
      <div className="absolute left-[9%] right-[14%] bottom-[7%] text-center text-[12.5px] font-semibold text-white/70">{t('Tap to open')}</div>
    </div>
  );
}

function Page({ n, no, total }: { n: Note; no: number; total: number }) {
  return (
    <div className="absolute inset-0 bg-white rounded-r-[10px] overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element -- the page picture is stored inside the note */}
      {n.photo && <img src={n.photo} alt={n.title} draggable={false} className="absolute inset-0 w-full h-full object-cover select-none" />}
      {/* the binding's shadow near the spine */}
      <div className="absolute inset-y-0 left-0 w-[10%] pointer-events-none" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,.16), rgba(0,0,0,0))' }} />
      <div className="absolute top-0 inset-x-0 flex justify-between gap-2 pl-[11%] pr-3 pt-2 text-[11.5px] text-[#5D6B77] pointer-events-none">
        <span className="truncate font-semibold">{n.title}</span>
        <span className="flex-none">{fmt(new Date(n.updated), { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </div>
      <div className="absolute bottom-1.5 right-3 text-[11.5px] font-semibold text-[#5D6B77] pointer-events-none">{t('Page {n} of {total}', { n: no, total })}</div>
    </div>
  );
}

/** The other side of a page (or the inside of the cover), seen while it turns. */
function Back({ cover }: { cover?: boolean }) {
  return <div className="absolute inset-0 rounded-l-[10px] overflow-hidden" style={{ background: cover ? '#E6E1D3' : PAPER_BACK }} />;
}

export function Copybook() {
  const pages = app.S.notes.filter(isPage).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)); // ids start with the time they were made
  const total = pages.length;
  // How many leaves are turned over: 0 = closed, 1 = cover open and page 1 showing, k = page k showing.
  const [turned, setAt] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const last = Math.max(1, total);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const book = useRef<HTMLDivElement>(null);

  const at = Math.min(turned, last); // a page may have been removed (here or on another device)

  const go = (to: number) => { setConfirm(false); setAt(Math.min(last, Math.max(0, to))); };
  const next = () => go(at + 1), prev = () => go(at - 1);
  const current = at >= 1 ? pages[at - 1] : undefined;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    else if (e.key === 'Escape' && at) go(0);
  };
  const onDown = (e: React.PointerEvent) => { swipe.current = { x: e.clientX, y: e.clientY }; };
  const onUp = (e: React.PointerEvent) => {
    const s = swipe.current; swipe.current = null; if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) next(); else prev(); return; }
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) return;
    if (!at) { next(); return; }
    // A tap: right part of the page turns forward, left part turns back.
    const r = book.current!.getBoundingClientRect();
    if (e.clientX - r.left > r.width * 0.5) next(); else prev();
  };

  const removePage = async () => {
    if (!current) return;
    app.S.notes = app.S.notes.filter((x) => x.id !== current.id);
    setConfirm(false);
    await save(); toast('Page removed');
  };
  const openPicture = async () => {
    if (!current?.photo) return;
    viewBlob(await dataUrlBlob(current.photo), (current.title || 'page') + '.jpg', 'image/jpeg');
  };

  // The leaves, front to back: the cover, then each page. Under them all lies the back of the book.
  const leaves: { key: string; front: React.ReactNode; cover?: boolean }[] = [
    { key: 'cover', front: <Cover count={total} />, cover: true },
    ...pages.map((n, i) => ({ key: n.id, front: <Page n={n} no={i + 1} total={total} /> })),
  ];
  const L = leaves.length;

  return (
    <div className="grid gap-2.5 -mx-4 px-4 py-2 overflow-hidden">
      <div className="mx-auto relative" style={{ width: 'min(100%, 320px, calc((100dvh - 280px) * 0.75))', minWidth: 200, aspectRatio: '3 / 4', perspective: 1800 }}>
        {/* the back of the book, with the edges of the pages showing */}
        <div className="absolute inset-0 rounded-r-[14px] rounded-l-[4px]" style={{ background: COVER, transform: 'translate(5px, 5px)' }} />
        <div className="absolute inset-0 rounded-r-[10px] bg-[#FBF9F4]" style={{ boxShadow: '1px 1px 0 #E3DED1, 2px 2px 0 #FBF9F4, 3px 3px 0 #E3DED1, 4px 4px 0 #FBF9F4', transform: 'translate(1px, 1px)' }}>
          {!total && at > 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
              <b className="font-display text-[18px] text-[#14212B]">{t('No pages yet')}</b>
              <span className="text-[13.5px] text-[#5D6B77]">{t('Draw something on the sketch pad and tap Save page.')}</span>
            </div>
          )}
        </div>

        <div ref={book} tabIndex={0} role="group" aria-roledescription={t('Copybook')}
          aria-label={at ? (current ? t('Page {n} of {total}', { n: at, total }) : t('No pages yet')) : t('Copybook')}
          onKeyDown={onKey} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { swipe.current = null; }}
          className="absolute inset-0 outline-none cursor-pointer touch-pan-y select-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-r-[14px]"
          style={{ transformStyle: 'preserve-3d' }}>
          {leaves.map((lf, i) => {
            const over = i < at;
            return (
              <div key={lf.key} className="absolute inset-0" style={{
                transformOrigin: 'left center', transformStyle: 'preserve-3d',
                transform: over ? 'rotateY(-180deg)' : 'rotateY(0deg)',
                // A turning page stays on top; once turned it is hidden, until it is turned back.
                zIndex: over ? 2 * L + i + 1 : 2 * L - i,
                visibility: over ? 'hidden' : 'visible',
                transition: over
                  ? `transform ${TURN_MS}ms cubic-bezier(.45,.05,.3,1), visibility 0s linear ${TURN_MS}ms`
                  : `transform ${TURN_MS}ms cubic-bezier(.45,.05,.3,1), visibility 0s linear 0s`,
                boxShadow: lf.cover ? '0 6px 18px rgba(20,33,43,.28)' : '0 1px 3px rgba(20,33,43,.18)',
                borderRadius: lf.cover ? '4px 14px 14px 4px' : '0 10px 10px 0',
              }}>
                <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
                  {lf.front}
                  {/* the page darkens as it lifts away from the light */}
                  <div className="absolute inset-0 pointer-events-none rounded-[inherit]" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,.05), rgba(0,0,0,.35))', opacity: over ? 1 : 0, transition: `opacity ${TURN_MS / 2}ms linear` }} />
                </div>
                <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}><Back cover={lf.cover} /></div>
              </div>
            );
          })}
        </div>
      </div>

      {at > 0 && (
        <>
          <div className="flex items-center justify-center gap-2">
            <button type="button" onClick={prev} aria-label={t('Previous page')} className={cls.pill(false) + ' !px-4 text-lg leading-none'}>‹</button>
            <span className="text-[13.5px] font-semibold text-[var(--muted)] min-w-[110px] text-center">{total ? t('Page {n} of {total}', { n: at, total }) : t('No pages yet')}</span>
            <button type="button" onClick={next} disabled={at >= last} aria-label={t('Next page')} className={cls.pill(false) + ' !px-4 text-lg leading-none disabled:opacity-40'}>›</button>
          </div>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            <button type="button" onClick={() => go(0)} className={cls.link}>{t('Close the copybook')}</button>
            {current && <button type="button" onClick={openPicture} className={cls.link}>{t('Open as picture')}</button>}
            {current && (!confirm
              ? <button type="button" onClick={() => setConfirm(true)} className={cls.link + ' !text-[var(--danger)]'}>{t('Remove page')}</button>
              : <span className="flex gap-3 items-center text-sm"><b className="text-[var(--ink)]">{t('Remove this page?')}</b>
                  <button type="button" onClick={removePage} className={cls.link + ' !text-[var(--danger)]'}>{t('Delete')}</button>
                  <button type="button" onClick={() => setConfirm(false)} className={cls.link}>{t('Keep it')}</button></span>)}
          </div>
        </>
      )}
    </div>
  );
}
