'use client';
// Downloads the AI model files in small pieces, so a phone can finish a 1–2 GB download.
//
// The library's own download keeps each whole file in memory and has no time-out or retry, so on a
// phone it can stop at some percentage and never finish. Here every file is fetched in 16 MB pieces
// (HTTP range requests). Each finished piece is saved straight away, so a dropped connection, a
// locked screen or closing Dayline only loses the piece in progress: the next try continues from
// there. A piece that receives nothing for 30 seconds is cancelled and tried again.
// When all pieces of a file are in, they are joined and stored where the library looks for it
// (the "transformers-cache" browser cache, under the file's Hugging Face address).

const CACHE = 'transformers-cache';
const PARTS = 'dayline-ai-parts';
const PIECE = 16 * 1024 * 1024;
const STALL_MS = 30000;
const WORKERS = 3;
const TRIES = 12;

export interface DlFile { name: string; url: string }
export interface DlProgress { done: number; total: number; note: string }

async function sizeOf(url: string, signal: AbortSignal): Promise<number> {
  // A one-byte range request tells the real size (a HEAD request can report a compressed size).
  const r = await fetch(url, { headers: { Range: 'bytes=0-0' }, cache: 'no-store', signal });
  const m = (r.headers.get('content-range') || '').match(/\/(\d+)\s*$/);
  if (r.status === 206) await r.body?.cancel().catch(() => {});
  if (m) return Number(m[1]);
  const len = Number(r.headers.get('content-length') || 0);
  if (r.status === 200) await r.body?.cancel().catch(() => {});
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return len;
}

const wait = (ms: number, signal: AbortSignal) => new Promise<void>((res, rej) => {
  const t = setTimeout(res, ms);
  signal.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('stopped', 'AbortError')); }, { once: true });
});

/** Fetches bytes [from, to] of the file, cancelling it if nothing arrives for a while. */
async function fetchPiece(url: string, from: number, to: number, outer: AbortSignal, onBytes: (n: number) => void): Promise<Uint8Array> {
  const ctl = new AbortController();
  const stop = () => ctl.abort();
  outer.addEventListener('abort', stop, { once: true });
  let timer = setTimeout(stop, STALL_MS);
  const alive = () => { clearTimeout(timer); timer = setTimeout(stop, STALL_MS); };
  let got = 0;
  try {
    const r = await fetch(url, { headers: { Range: `bytes=${from}-${to}` }, cache: 'no-store', signal: ctl.signal });
    if (r.status !== 206 && !(r.status === 200 && from === 0)) throw new Error(`HTTP ${r.status}`);
    const want = to - from + 1;
    const buf = new Uint8Array(want);
    const reader = r.body!.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      alive();
      if (got + value.length > want) { // the server sent the whole file: keep only this piece
        buf.set(value.subarray(0, want - got), got); onBytes(want - got); got = want;
        await reader.cancel().catch(() => {});
        break;
      }
      buf.set(value, got); got += value.length; onBytes(value.length);
    }
    if (got !== want) throw new Error('incomplete piece');
    return buf;
  } catch (e) {
    onBytes(-got); // those bytes will be fetched again
    throw e;
  } finally {
    clearTimeout(timer);
    outer.removeEventListener('abort', stop);
  }
}

/**
 * Makes sure every file is in the browser cache. Calls `onProgress` with bytes done and total.
 * Throws if it cannot finish (no internet, no space) — calling it again continues where it stopped.
 */
export async function downloadFiles(files: DlFile[], onProgress: (p: DlProgress) => void, signal: AbortSignal) {
  const cache = await caches.open(CACHE);
  const parts = await caches.open(PARTS);

  // What is still missing, and how big everything is.
  const todo: { f: DlFile; size: number; pieces: number }[] = [];
  let total = 0, done = 0;
  for (const f of files) {
    const hit = await cache.match(f.url);
    if (hit) {
      const n = Number(hit.headers.get('content-length') || 0);
      total += n; done += n;
      continue;
    }
    let size = 0;
    for (let i = 0; ; i++) {
      try { size = await sizeOf(f.url, signal); break; }
      catch (e) { if (signal.aborted || i >= 3) throw e; await wait(2000 * (i + 1), signal); }
    }
    total += size;
    todo.push({ f, size, pieces: Math.max(1, Math.ceil(size / PIECE)) });
  }

  // Pieces already saved by an earlier try.
  const queue: { f: DlFile; size: number; i: number; key: string }[] = [];
  for (const x of todo) for (let i = 0; i < x.pieces; i++) {
    const key = `${x.f.url}?dayline-piece=${i}`;
    if (await parts.match(key)) done += Math.min(PIECE, x.size - i * PIECE);
    else queue.push({ f: x.f, size: x.size, i, key });
  }

  let note = '';
  const report = () => onProgress({ done, total, note });
  report();

  // A few pieces at a time; each one is retried on its own.
  let failure: unknown = null;
  const worker = async () => {
    for (let job = queue.shift(); job && !failure; job = queue.shift()) {
      const from = job.i * PIECE, to = Math.min(job.size, from + PIECE) - 1;
      for (let tryNo = 1; ; tryNo++) {
        try {
          const bytes = await fetchPiece(job.f.url, from, to, signal, (n) => { done += n; report(); });
          await parts.put(job.key, new Response(bytes as BlobPart, { headers: { 'content-length': String(bytes.length) } }));
          if (note) { note = ''; report(); }
          break;
        } catch (e) {
          if (signal.aborted) { failure = e; return; }
          if (/quota/i.test(String((e as Error)?.name) + String((e as Error)?.message))) { failure = e; return; }
          if (tryNo >= TRIES) { failure = e; return; }
          note = navigator.onLine ? 'Connection is slow. Trying again…' : 'Waiting for the internet…';
          report();
          await wait(Math.min(30000, 2000 * tryNo), signal).catch(() => {});
          if (signal.aborted) { failure = e; return; }
        }
      }
    }
  };
  await Promise.all(Array.from({ length: WORKERS }, worker));
  if (failure) throw failure;

  // Join the pieces of each file and store it where the library will find it.
  for (const x of todo) {
    note = 'Saving…'; report();
    const blobs: Blob[] = [];
    for (let i = 0; i < x.pieces; i++) {
      const r = await parts.match(`${x.f.url}?dayline-piece=${i}`);
      if (!r) throw new Error('missing piece');
      blobs.push(await r.blob());
    }
    const whole = new Blob(blobs);
    if (whole.size !== x.size) throw new Error('size mismatch');
    await cache.put(x.f.url, new Response(whole, { headers: { 'content-length': String(x.size), 'content-type': 'application/octet-stream' } }));
    for (let i = 0; i < x.pieces; i++) await parts.delete(`${x.f.url}?dayline-piece=${i}`);
  }
  note = ''; report();
}

/** Removes half-finished pieces. */
export async function clearPieces() { try { await caches.delete(PARTS); } catch { /* none */ } }
