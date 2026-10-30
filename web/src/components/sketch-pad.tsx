'use client';
// The sketch pad: a drawing page for quick drafts, like a notebook and pen (or a small Paint).
// Tools: pen, marker, eraser, line, arrow, rectangle, ellipse and text, with colours, three sizes,
// plain / grid / dotted paper, undo and redo. Drafts are kept on this phone; "Save to Notes" turns
// a drawing into a photo note, which syncs like any other note.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { app, save, toast } from '@/lib/store';
import { uid } from '@/lib/dates';
import { showBlob } from '@/lib/files';
import { t } from '@/lib/i18n';
import { PAGE_H, PAGE_W, deleteDraft, listDrafts, loadDraftImage, newDraft, updateDraft, type Draft, type Paper } from '@/lib/drafts';
import { cls } from './ui';

type Tool = 'pen' | 'marker' | 'eraser' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text';
type Pt = [number, number];
type Op =
  | { k: 'pen' | 'marker' | 'eraser'; c: string; s: number; pts: Pt[] }
  | { k: 'line' | 'arrow' | 'rect' | 'ellipse'; c: string; s: number; a: Pt; b: Pt }
  | { k: 'text'; c: string; s: number; at: Pt; text: string };

const COLORS = ['#14212B', '#2F5BEA', '#C2362B', '#1E9668', '#DB5F33', '#8650D6', '#FFC93C', '#FFFFFF'];
const SIZES = [4, 9, 18];
const FONT = [36, 56, 88];
const GRID = 40; // paper squares, in page pixels

/* ---------- drawing ---------- */
function drawOp(ctx: CanvasRenderingContext2D, op: Op) {
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = op.c; ctx.fillStyle = op.c;
  if (op.k === 'pen' || op.k === 'marker' || op.k === 'eraser') {
    ctx.lineWidth = op.k === 'pen' ? op.s : op.s * 3;
    if (op.k === 'marker') ctx.globalAlpha = 0.35;
    if (op.k === 'eraser') ctx.globalCompositeOperation = 'destination-out';
    const p = op.pts;
    ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
    if (p.length === 1) ctx.lineTo(p[0][0] + 0.1, p[0][1]);
    for (let i = 1; i < p.length - 1; i++) ctx.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
    if (p.length > 1) ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
    ctx.stroke();
  } else if (op.k === 'text') {
    ctx.font = `600 ${FONT[SIZES.indexOf(op.s)] || 56}px Figtree, system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    op.text.split('\n').forEach((line, i) => ctx.fillText(line, op.at[0], op.at[1] + i * (FONT[SIZES.indexOf(op.s)] || 56) * 1.25));
  } else if ('a' in op) {
    ctx.lineWidth = op.s;
    const [x1, y1] = op.a, [x2, y2] = op.b;
    ctx.beginPath();
    if (op.k === 'rect') ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    else if (op.k === 'ellipse') ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
    else {
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      if (op.k === 'arrow') {
        const ang = Math.atan2(y2 - y1, x2 - x1), h = Math.max(24, op.s * 4);
        ctx.moveTo(x2, y2); ctx.lineTo(x2 - h * Math.cos(ang - 0.45), y2 - h * Math.sin(ang - 0.45));
        ctx.moveTo(x2, y2); ctx.lineTo(x2 - h * Math.cos(ang + 0.45), y2 - h * Math.sin(ang + 0.45));
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawPaper(ctx: CanvasRenderingContext2D, paper: Paper) {
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  if (paper === 'plain') return;
  ctx.fillStyle = ctx.strokeStyle = '#C9D3DC'; ctx.lineWidth = 1.5;
  for (let x = GRID; x < PAGE_W; x += GRID) for (let y = GRID; y < PAGE_H; y += GRID) {
    if (paper === 'dots') { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill(); }
  }
  if (paper === 'grid') {
    ctx.beginPath();
    for (let x = GRID; x < PAGE_W; x += GRID) { ctx.moveTo(x, 0); ctx.lineTo(x, PAGE_H); }
    for (let y = GRID; y < PAGE_H; y += GRID) { ctx.moveTo(0, y); ctx.lineTo(PAGE_W, y); }
    ctx.stroke();
  }
}

const blobToImage = (b: Blob) => createImageBitmap(b);
const canvasBlob = (c: HTMLCanvasElement, type = 'image/png', q?: number) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('empty'))), type, q));

/* ---------- small icons for the tools ---------- */
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const TOOL_ICON: Record<Tool, React.ReactNode> = {
  pen: <svg viewBox="0 0 24 24" {...P}><path d="M4 20l1-4L16 5l3 3L8 19z" /><path d="M14 7l3 3" /></svg>,
  marker: <svg viewBox="0 0 24 24" {...P}><path d="M5 19h6" /><path d="M8 16l-2-2 9-9 4 4-9 9z" /><path d="M6 14l-2 4 4-2" /></svg>,
  eraser: <svg viewBox="0 0 24 24" {...P}><path d="M8 20h12" /><path d="M4.5 15.5l9-9a2 2 0 012.8 0l2.2 2.2a2 2 0 010 2.8L11 19H8z" /></svg>,
  line: <svg viewBox="0 0 24 24" {...P}><path d="M5 19L19 5" /></svg>,
  arrow: <svg viewBox="0 0 24 24" {...P}><path d="M5 19L19 5M11 5h8v8" /></svg>,
  rect: <svg viewBox="0 0 24 24" {...P}><rect x="4" y="6" width="16" height="12" rx="1" /></svg>,
  ellipse: <svg viewBox="0 0 24 24" {...P}><ellipse cx="12" cy="12" rx="8.5" ry="6.5" /></svg>,
  text: <svg viewBox="0 0 24 24" {...P}><path d="M5 6V4h14v2M12 4v16M9 20h6" /></svg>,
};
const TOOL_NAME: Record<Tool, string> = { pen: 'Pen', marker: 'Marker', eraser: 'Eraser', line: 'Line', arrow: 'Arrow', rect: 'Rectangle', ellipse: 'Ellipse', text: 'Text' };
const btn = 'h-10 min-w-10 px-2 rounded-xl flex items-center justify-center border cursor-pointer';

export function SketchPad() {
  const ink = useRef<HTMLCanvasElement>(null);
  const over = useRef<HTMLCanvasElement>(null);
  const base = useRef<ImageBitmap | null>(null); // the drawing as it was when opened
  const ops = useRef<Op[]>([]);
  const redo = useRef<Op[]>([]);
  const live = useRef<Op | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [cur, setCur] = useState<Draft | null>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[0]);
  const [, setVer] = useState(0); // redraws the undo / redo buttons
  const [textAt, setTextAt] = useState<Pt | null>(null);
  const [textVal, setTextVal] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  const bump = () => setVer((v) => v + 1);

  const redraw = useCallback(() => {
    const c = ink.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, PAGE_W, PAGE_H);
    if (base.current) ctx.drawImage(base.current, 0, 0);
    ops.current.forEach((o) => drawOp(ctx, o));
  }, []);

  const persist = useCallback((d: Draft | null) => {
    if (!d) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { await updateDraft(d, await canvasBlob(ink.current!)); setDrafts(await listDrafts()); }
      catch { toast('Could not save. Your phone may be out of space.'); }
    }, 700);
  }, []);

  const open = useCallback(async (d: Draft) => {
    ops.current = []; redo.current = []; base.current = null; setTextAt(null); setConfirmDel(false);
    const b = await loadDraftImage(d.id);
    if (b) { try { base.current = await blobToImage(b); } catch { /* damaged picture: start blank */ } }
    setCur(d); redraw(); bump();
  }, [redraw]);

  // Open the latest draft, or start the first one.
  useEffect(() => {
    let alive = true;
    (async () => {
      let l = await listDrafts();
      if (!l.length) { await newDraft(1); l = await listDrafts(); }
      if (!alive) return;
      setDrafts(l); open(l[0]);
    })();
    return () => { alive = false; };
  }, [open]);

  // Save straight away when leaving the tab.
  useEffect(() => () => {
    if (saveTimer.current && ink.current && cur) {
      clearTimeout(saveTimer.current);
      const c = ink.current, d = cur;
      canvasBlob(c).then((b) => updateDraft(d, b)).catch(() => {});
    }
  }, [cur]);

  const commit = (op: Op) => {
    ops.current.push(op); redo.current = [];
    drawOp(ink.current!.getContext('2d')!, op);
    bump(); persist(cur);
  };

  /* ---------- pointer ---------- */
  const pt = (e: React.PointerEvent): Pt => {
    const r = ink.current!.getBoundingClientRect();
    return [Math.round((e.clientX - r.left) * PAGE_W / r.width), Math.round((e.clientY - r.top) * PAGE_H / r.height)];
  };
  const clearOver = () => over.current?.getContext('2d')!.clearRect(0, 0, PAGE_W, PAGE_H);

  const down = (e: React.PointerEvent) => {
    if (!cur || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const p = pt(e);
    if (tool === 'text') { setTextAt(p); setTextVal(''); return; }
    (e.target as Element).setPointerCapture(e.pointerId);
    if (tool === 'pen' || tool === 'marker' || tool === 'eraser') {
      live.current = { k: tool, c: color, s: size, pts: [p] };
      if (tool === 'pen' || tool === 'eraser') drawOp(ink.current!.getContext('2d')!, live.current);
    } else live.current = { k: tool, c: color, s: size, a: p, b: p };
  };
  const move = (e: React.PointerEvent) => {
    const op = live.current; if (!op) return;
    const p = pt(e);
    if ('pts' in op) {
      const last = op.pts[op.pts.length - 1];
      if (Math.abs(last[0] - p[0]) + Math.abs(last[1] - p[1]) < 3) return;
      op.pts.push(p);
      if (op.k === 'marker') { clearOver(); drawOp(over.current!.getContext('2d')!, { ...op, k: 'pen', s: op.s * 3 }); } // shown see-through by the overlay
      else drawOp(ink.current!.getContext('2d')!, { ...op, pts: op.pts.slice(-3) });
    } else if ('a' in op) {
      op.b = p; clearOver(); drawOp(over.current!.getContext('2d')!, op);
    }
  };
  const up = () => {
    const op = live.current; if (!op) return;
    live.current = null; clearOver();
    if ('pts' in op) {
      ops.current.push(op); redo.current = [];
      redraw(); // the smooth version of the whole stroke
      bump(); persist(cur);
    } else if ('a' in op) {
      if (Math.abs(op.a[0] - op.b[0]) + Math.abs(op.a[1] - op.b[1]) > 6) commit(op);
    }
  };

  const placeText = (e: React.FormEvent) => {
    e.preventDefault();
    if (textAt && textVal.trim()) commit({ k: 'text', c: color, s: size, at: textAt, text: textVal.trim() });
    setTextAt(null); setTextVal('');
  };

  /* ---------- page actions ---------- */
  const undo = () => { const o = ops.current.pop(); if (o) { redo.current.push(o); redraw(); bump(); persist(cur); } };
  const redoOne = () => { const o = redo.current.pop(); if (o) { ops.current.push(o); redraw(); bump(); persist(cur); } };
  const clearPage = () => {
    // Clearing can be undone too: it becomes an eraser over the whole page.
    commit({ k: 'eraser', c: '#000', s: 2000, pts: [[0, 0], [PAGE_W, PAGE_H / 2], [0, PAGE_H], [PAGE_W, PAGE_H]] });
  };
  const setPaper = (p: Paper) => { if (!cur) return; const d = { ...cur, paper: p }; setCur(d); updateDraft(d).then(async () => setDrafts(await listDrafts())); };
  const addDraft = async () => {
    if (cur && saveTimer.current) { clearTimeout(saveTimer.current); await updateDraft(cur, await canvasBlob(ink.current!)); }
    const d = await newDraft(drafts.length + 1); setDrafts(await listDrafts()); open(d); toast('New draft');
  };
  const switchTo = async (d: Draft) => {
    if (d.id === cur?.id) return;
    if (cur && saveTimer.current) { clearTimeout(saveTimer.current); await updateDraft(cur, await canvasBlob(ink.current!)); }
    open(d);
  };
  const remove = async () => {
    if (!cur) return;
    await deleteDraft(cur.id);
    let l = await listDrafts();
    if (!l.length) { await newDraft(1); l = await listDrafts(); }
    setDrafts(l); open(l[0]); toast('Draft deleted');
  };
  const rename = (title: string) => { if (!cur) return; const d = { ...cur, title }; setCur(d); persist(d); };

  /** The drawing on its paper, as one picture. */
  const flatten = async (maxSide: number) => {
    const c = document.createElement('canvas'), sc = Math.min(1, maxSide / PAGE_H);
    c.width = Math.round(PAGE_W * sc); c.height = Math.round(PAGE_H * sc);
    const ctx = c.getContext('2d')!;
    ctx.scale(sc, sc); drawPaper(ctx, cur?.paper || 'plain'); ctx.drawImage(ink.current!, 0, 0);
    return c;
  };
  const toNote = async () => {
    const c = await flatten(1200);
    app.S.notes.push({ id: uid(), type: 'text', title: cur?.title || t('Sketch'), body: '', items: [], photo: c.toDataURL('image/jpeg', 0.8), locked: false, updated: Date.now() });
    await save(); toast('Saved to Notes');
  };
  const saveImage = async () => {
    const c = await flatten(PAGE_H);
    showBlob(await canvasBlob(c), `${(cur?.title || 'sketch').replace(/[^\w\- ]+/g, '').trim() || 'sketch'}.png`);
  };

  const paperBg: Record<Paper, React.CSSProperties> = {
    plain: {},
    grid: { backgroundImage: 'linear-gradient(#C9D3DC 1px, transparent 1px), linear-gradient(90deg, #C9D3DC 1px, transparent 1px)', backgroundSize: `calc(100% / ${PAGE_W / GRID}) calc(100% / ${PAGE_H / GRID})` },
    dots: { backgroundImage: 'radial-gradient(#C9D3DC 1.2px, transparent 1.3px)', backgroundSize: `calc(100% / ${PAGE_W / GRID}) calc(100% / ${PAGE_H / GRID})`, backgroundPosition: `calc(-50% / ${PAGE_W / GRID}) calc(-50% / ${PAGE_H / GRID})` },
  };
  const on = (x: boolean) => x ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]' : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--line)]';

  return (
    <div className="grid gap-2.5">
      {/* drafts */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {drafts.map((d) => (
          <button key={d.id} type="button" onClick={() => switchTo(d)} className={cls.pill(d.id === cur?.id) + ' flex-none max-w-[160px] overflow-hidden text-ellipsis'}>{d.title}</button>
        ))}
        <button type="button" onClick={addDraft} className={cls.pill(false) + ' flex-none text-[var(--accent)]'}>{t('+ New draft')}</button>
      </div>

      {/* tools */}
      <div className="bg-[var(--surface)] rounded-2xl p-2.5 grid gap-2 border border-[var(--line)]">
        <div className="flex gap-1 overflow-x-auto" role="toolbar" aria-label={t('Drawing tools')}>
          {(Object.keys(TOOL_ICON) as Tool[]).map((k) => (
            <button key={k} type="button" onClick={() => { setTool(k); setTextAt(null); }} aria-pressed={tool === k} aria-label={t(TOOL_NAME[k])} title={t(TOOL_NAME[k])}
              className={`${btn} w-9 min-w-9 flex-none ${on(tool === k)} [&>svg]:w-5 [&>svg]:h-5`}>{TOOL_ICON[k]}</button>
          ))}
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={t('Colour {c}', { c })} aria-pressed={color === c}
              className={`w-7 h-7 flex-none rounded-full border-2 cursor-pointer ${color === c ? 'border-[var(--accent)] scale-110' : 'border-[var(--line)]'}`} style={{ backgroundColor: c }} />
          ))}
          <span className="w-px h-6 flex-none bg-[var(--line)] mx-0.5" />
          {SIZES.map((s, i) => (
            <button key={s} type="button" onClick={() => setSize(s)} aria-pressed={size === s} aria-label={t(['Thin', 'Medium', 'Thick'][i])} className={`${btn} !h-8 w-8 min-w-8 flex-none ${on(size === s)}`}>
              <span className="rounded-full bg-current" style={{ width: 4 + i * 5, height: 4 + i * 5 }} />
            </button>
          ))}
        </div>
      </div>

      {textAt && (
        <form onSubmit={placeText} className="flex gap-2 items-center bg-[var(--surface)] border border-[var(--accent)] rounded-2xl p-1.5 pl-3">
          <input id="sk-text" autoFocus value={textVal} onChange={(e) => setTextVal(e.target.value)} placeholder={t('Type the text to place')} enterKeyHint="done"
            className="flex-1 min-w-0 bg-transparent border-0 py-2 outline-none text-[16px] text-[var(--ink)] placeholder:text-[var(--muted)]" />
          <button type="button" onClick={() => setTextAt(null)} className={cls.ghost}>{t('Cancel')}</button>
          <button type="submit" className={cls.primary + ' py-2 px-4'}>{t('Place')}</button>
        </form>
      )}

      {/* the page */}
      {/* As large as fits on screen above the tab bar, keeping the page's shape. */}
      <div className="relative mx-auto rounded-xl overflow-hidden shadow-[var(--shadow)] border border-[var(--line)] bg-white"
        style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}`, width: `min(100%, calc((100dvh - 300px) * ${PAGE_W / PAGE_H}))`, minWidth: 220, ...paperBg[cur?.paper || 'plain'] }}>
        <canvas ref={ink} width={PAGE_W} height={PAGE_H} className="absolute inset-0 w-full h-full" />
        <canvas ref={over} width={PAGE_W} height={PAGE_H} aria-label={t('Drawing page')} role="img"
          className={`absolute inset-0 w-full h-full touch-none ${tool === 'marker' ? 'opacity-35' : ''} ${tool === 'text' ? 'cursor-text' : 'cursor-crosshair'}`}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
        {textAt && <span className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-[var(--accent)] pointer-events-none" style={{ left: `${textAt[0] / PAGE_W * 100}%`, top: `${textAt[1] / PAGE_H * 100}%` }} />}
      </div>

      {/* page actions */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={undo} disabled={!ops.current.length} className={`${btn} ${on(false)} disabled:opacity-40 font-semibold text-sm`}>{t('Undo')}</button>
        <button type="button" onClick={redoOne} disabled={!redo.current.length} className={`${btn} ${on(false)} disabled:opacity-40 font-semibold text-sm`}>{t('Redo')}</button>
        <button type="button" onClick={clearPage} className={`${btn} ${on(false)} font-semibold text-sm`}>{t('Clear page')}</button>
        <span className="flex-1" />
        {(['plain', 'grid', 'dots'] as Paper[]).map((p) => (
          <button key={p} type="button" onClick={() => setPaper(p)} aria-pressed={cur?.paper === p} className={cls.pill(cur?.paper === p) + ' !px-2.5 !py-1 !text-[13px]'}>{t({ plain: 'Plain', grid: 'Grid', dots: 'Dots' }[p])}</button>
        ))}
      </div>

      <div className="bg-[var(--surface)] rounded-2xl p-3 grid gap-2 border border-[var(--line)]">
        <label htmlFor="sk-title" className={cls.label + ' !mt-0'}>{t('Draft name')}</label>
        <input id="sk-title" value={cur?.title || ''} onChange={(e) => rename(e.target.value)} className={cls.input} />
        <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
          <button type="button" onClick={toNote} className={cls.link}>{t('Save to Notes')}</button>
          <button type="button" onClick={saveImage} className={cls.link}>{t('Save as picture')}</button>
          {!confirmDel
            ? <button type="button" onClick={() => setConfirmDel(true)} className={cls.link + ' !text-[var(--danger)]'}>{t('Delete draft')}</button>
            : <span className="flex gap-3 items-center text-sm"><b className="text-[var(--ink)]">{t('Delete this draft?')}</b>
                <button type="button" onClick={remove} className={cls.link + ' !text-[var(--danger)]'}>{t('Delete')}</button>
                <button type="button" onClick={() => setConfirmDel(false)} className={cls.link}>{t('Keep it')}</button></span>}
        </div>
        <p className="m-0 text-[12.5px] text-[var(--muted)]">{t('Drafts are saved on this phone as you draw. Save to Notes to keep a drawing on all your devices.')}</p>
      </div>
    </div>
  );
}
