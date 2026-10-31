'use client';
// The optional AI assistant, running on the phone itself.
//
// Two models to choose from in Settings:
//  - Small (Qwen 3.5 0.8B, about 0.6 GB): starts on most phones.
//  - Large (Google Gemma 4 E2B, about 1.5–2 GB): smarter, but needs a strong phone with plenty of memory.
// The chosen model is downloaded once (see ai-download.ts), kept in the browser's storage and works
// offline. It runs on the phone's graphics chip (WebGPU), so it needs Chrome/Edge 113+ or Safari on
// iOS 26. The library that runs it (Transformers.js) is loaded only when the assistant is used.

import { emit } from './store';
import { clearPieces, downloadFiles } from './ai-download';

const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js';
const TASK = 'text-generation';
const FLAG = 'dayline-ai';               // "1" once a model has started successfully
const MODEL_KEY = 'dayline-ai-model';    // which model the user chose
const DTYPE_KEY = 'dayline-ai-dtype';    // the weight format that suits this phone, per model
const START_KEY = 'dayline-ai-starting'; // set while the model is starting: left behind if the page crashed
const START_LIMIT = 4 * 60 * 1000;

export type ModelChoice = 'small' | 'large';
export const MODELS: Record<ModelChoice, { id: string; name: string; approx: string }> = {
  small: { id: 'onnx-community/Qwen3.5-0.8B-ONNX', name: 'Qwen 3.5 0.8B', approx: 'about 0.6 GB' },
  large: { id: 'onnx-community/gemma-4-E2B-it-ONNX', name: 'Gemma 4 E2B', approx: 'about 1.5–2 GB' },
};

export type AiStatus = 'off' | 'unsupported' | 'downloading' | 'loading' | 'ready' | 'error';
export interface ChatMsg { role: 'user' | 'assistant'; content: string }

/* eslint-disable @typescript-eslint/no-explicit-any -- the library is loaded at run time, untyped */
let lib: any = null;
let gen: any = null;
let genModel: ModelChoice | null = null;
let loading: Promise<void> | null = null;

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export const ai = {
  status: 'off' as AiStatus,
  /** 0–100 while downloading or starting. */
  progress: 0,
  error: '',
  /** Bytes the download needs, when known. */
  size: 0,
  /** Bytes downloaded so far. */
  done: 0,
  /** A short note during the download ("Connection is slow…"). */
  note: '',
  busy: false,
  /** True if the last start was cut off (the page crashed or was closed while starting). */
  crashed: typeof window !== 'undefined' && !!ls.get(START_KEY),
};

/** Whether the assistant is on (a model has started on this phone before). */
export const aiEnabled = () => ls.get(FLAG) === '1';
export const aiModel = (): ModelChoice => (ls.get(MODEL_KEY) === 'large' ? 'large' : 'small');
export function setAiModel(m: ModelChoice) { ls.set(MODEL_KEY, m); emit(); }

function set(p: Partial<typeof ai>) { Object.assign(ai, p); emit(); }

async function adapter(): Promise<any> {
  try { return await (navigator as any).gpu?.requestAdapter(); } catch { return null; }
}
/** WebGPU is what makes the model fast enough. Without it, it would take minutes per answer. */
export async function webgpuOk(): Promise<boolean> { return !!(await adapter()); }

async function loadLib() {
  // Loaded from the web at run time, not bundled into Dayline: it is large and only needed here.
  if (!lib) lib = await (new Function('u', 'return import(u)'))(LIB);
  lib.env.useBrowserCache = true;
  lib.env.allowLocalModels = false;
  return lib;
}

/**
 * The weight format for this phone. "q4f16" is smallest and fastest but needs the graphics chip to
 * support half-precision maths ("shader-f16"); many phones don't, and then the model fails to start.
 * Those phones get "q4" instead. Remembered per model, so it also works offline.
 */
async function dtypeFor(L: any, m: ModelChoice): Promise<string> {
  const key = DTYPE_KEY + '-' + m, saved = ls.get(key);
  if (saved) return saved;
  const a = await adapter();
  const f16 = !!a?.features?.has?.('shader-f16');
  let have: string[] = [];
  try { have = await L.ModelRegistry.get_available_dtypes(MODELS[m].id); } catch { /* offline: guess */ }
  const pick = f16 && (!have.length || have.includes('q4f16')) ? 'q4f16'
    : have.includes('q4') ? 'q4' : have.includes('q4f16') ? 'q4f16' : have.includes('q8') ? 'q8' : 'q4';
  ls.set(key, pick);
  return pick;
}
const opts = (dtype: string) => ({ dtype, device: 'webgpu' });

/** Size of the download for the chosen model, for the button in Settings. */
export async function downloadSize(m: ModelChoice = aiModel()): Promise<number> {
  try {
    const L = await loadLib(), id = MODELS[m].id;
    const files: string[] = await L.ModelRegistry.get_pipeline_files(TASK, id, opts(await dtypeFor(L, m)));
    const sizes = await Promise.all(files.map((f) => L.ModelRegistry.get_file_metadata(id, f).then((x: any) => x?.size || 0).catch(() => 0)));
    const total = sizes.reduce((a: number, b: number) => a + b, 0);
    set({ size: total });
    return total;
  } catch { return 0; }
}

/** The address the library uses for a model file (and its key in the browser cache). */
function fileUrl(L: any, id: string, f: string) {
  const trim = (x: string) => x.replace(/^\/+|\/+$/g, '');
  const tpl = String(L.env.remotePathTemplate || '{model}/resolve/{revision}/').replaceAll('{model}', id).replaceAll('{revision}', 'main');
  return [String(L.env.remoteHost || 'https://huggingface.co/').replace(/\/+$/, ''), trim(tpl), trim(f)].join('/');
}

let dlCtl: AbortController | null = null;
/** Pauses the download. The finished parts are kept; Download continues from there. */
export function pauseDownload() { dlCtl?.abort(); }

/** Downloads (first time) or starts (later) the chosen model. Safe to call many times. */
export function startAi(): Promise<void> {
  const m = aiModel();
  if (gen && genModel === m) { set({ status: 'ready' }); return Promise.resolve(); }
  if (loading) return loading;
  loading = (async () => {
    if (!(await webgpuOk())) { set({ status: 'unsupported' }); loading = null; return; }
    set({ status: 'loading', progress: 0, error: '', note: '' });
    let lock: any = null, starting = false, timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (gen) { try { await gen.dispose?.(); } catch { /* gone */ } gen = null; genModel = null; }
      const L = await loadLib(), id = MODELS[m].id, dtype = await dtypeFor(L, m);
      const cached = await L.ModelRegistry.is_pipeline_cached(TASK, id, opts(dtype)).catch(() => false);
      if (!cached) {
        // Our own download in small, resumable pieces (see ai-download.ts).
        set({ status: 'downloading' });
        navigator.storage?.persist?.().catch(() => {});
        try { lock = await (navigator as any).wakeLock?.request('screen'); } catch { /* not allowed: fine */ }
        const files: string[] = await L.ModelRegistry.get_pipeline_files(TASK, id, opts(dtype));
        dlCtl = new AbortController();
        await downloadFiles(files.map((f) => ({ name: f, url: fileUrl(L, id, f) })), ({ done, total, note }) => {
          const p = total ? Math.min(99, Math.floor(done / total * 100)) : 0;
          if (p !== ai.progress || note !== ai.note || Math.abs(done - ai.done) > 4e6) set({ progress: p, size: total, done, note });
        }, dlCtl.signal);
        dlCtl = null;
        try { await lock?.release(); } catch { /* gone */ } lock = null;
      }
      // Open the model from the phone's storage and prepare it on the graphics chip.
      set({ status: 'loading', progress: 0, note: '' });
      ls.set(START_KEY, m); starting = true;
      const started = L.pipeline(TASK, id, {
        ...opts(dtype),
        progress_callback: (i: any) => {
          if (i.status === 'progress_total' && typeof i.progress === 'number') {
            const p = Math.floor(i.progress);
            if (p !== ai.progress) set({ progress: p });
          }
        },
      });
      gen = await Promise.race([started, new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('start-timeout')), START_LIMIT); })]);
      genModel = m;
      ls.set(FLAG, '1');
      set({ status: 'ready', progress: 100, crashed: false });
    } catch (e) {
      gen = null; genModel = null;
      try { await lock?.release(); } catch { /* gone */ }
      const paused = dlCtl?.signal.aborted; dlCtl = null;
      const msg = (String((e as Error)?.name || '') + ' ' + String((e as Error)?.message || e)).trim();
      console.error('Dayline AI:', e);
      set({ status: 'error', note: '', error: paused ? 'Download paused. Tap Download to continue; the finished part is kept.'
        : /quota/i.test(msg) ? 'Not enough free space on this phone for the AI model. Free some space, then tap Download to continue.'
        : !starting && !navigator.onLine ? 'The download needs the internet. Connect, then tap Download to continue where it stopped.'
        : starting && /start-timeout/.test(msg) ? 'The model did not start within 4 minutes. This phone is probably short of memory for it.'
        : starting ? 'The model could not start on this phone' + (m === 'large' ? ', most likely because it needs more memory.' : '.') + ' (' + msg.slice(0, 140) + ')'
        : 'The download could not finish. Tap Download to try again; it continues where it stopped. (' + msg.slice(0, 120) + ')' });
    } finally {
      clearTimeout(timer);
      if (starting) ls.set(START_KEY, null);
    }
    loading = null;
  })();
  return loading;
}

/** Deletes a model from this phone. Without an argument: the chosen one, and turns the assistant off. */
export async function removeAi(m: ModelChoice = aiModel(), turnOff = true) {
  if (turnOff) ls.set(FLAG, null);
  if (genModel === m || turnOff) { try { await gen?.dispose?.(); } catch { /* already gone */ } gen = null; genModel = null; }
  try {
    const L = await loadLib();
    for (const d of ['q4f16', 'q4', 'q8']) await L.ModelRegistry.clear_pipeline_cache(TASK, MODELS[m].id, opts(d)).catch(() => {});
  } catch { /* nothing cached */ }
  await clearPieces();
  ls.set(START_KEY, null);
  set({ status: 'off', progress: 0, error: '', size: 0, done: 0, crashed: false });
}

/** Switches to the other model: frees the space of the current one, then downloads the new one. */
export async function switchAiModel(m: ModelChoice) {
  const old = aiModel();
  if (old !== m) await removeAi(old, false);
  setAiModel(m);
  await startAi();
}

let stopper: any = null;
/** Stops the answer being written. */
export function stopAi() { stopper?.interrupt?.(); }

/**
 * Asks the model. `instructions` go first, then the conversation. `onText` gets the whole answer
 * so far as it is written. Returns the full answer.
 */
export async function askAi(instructions: string, chat: ChatMsg[], onText: (s: string) => void, maxTokens = 450): Promise<string> {
  await startAi();
  if (!gen) throw new Error(ai.error || 'not ready');
  const L = lib;
  // Some models have no separate "system" turn, so the instructions open the first message.
  const msgs = chat.map((x, i) => (i === 0 && x.role === 'user' ? { role: 'user', content: instructions + '\n\n' + x.content } : x));
  let text = '';
  stopper = new L.InterruptableStoppingCriteria();
  const streamer = new L.TextStreamer(gen.tokenizer, {
    skip_prompt: true, skip_special_tokens: true,
    callback_function: (s: string) => { text += s; onText(text.replace(/<think>[\s\S]*?(<\/think>\s*|$)/g, '')); },
  });
  set({ busy: true });
  try {
    const out = await gen(msgs, {
      max_new_tokens: maxTokens, do_sample: false, repetition_penalty: 1.1, streamer,
      stopping_criteria: stopper,
      tokenizer_encode_kwargs: { enable_thinking: false },
    });
    const full = out?.[0]?.generated_text;
    const last = Array.isArray(full) ? full.at(-1)?.content : full;
    const ans = (typeof last === 'string' && last.trim()) ? last : text;
    return ans.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trim();
  } finally { stopper = null; set({ busy: false }); }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
