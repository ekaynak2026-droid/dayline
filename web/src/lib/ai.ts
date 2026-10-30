'use client';
// The optional AI assistant: Google's Gemma 4 E2B, running on the phone itself.
//
// It is downloaded once (about 1–2 GB, from Hugging Face) when the user turns it on in Settings,
// then kept in the browser's storage and works offline. It runs on the phone's graphics chip
// (WebGPU), so it needs a recent browser: Chrome/Edge 113+, or Safari on iOS 26.
// The library that runs it (Transformers.js) is loaded only when the assistant is used.

import { emit } from './store';

const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js';
export const MODEL = 'onnx-community/gemma-4-E2B-it-ONNX';
const TASK = 'text-generation';
const FLAG = 'dayline-ai';

export type AiStatus = 'off' | 'unsupported' | 'downloading' | 'loading' | 'ready' | 'error';
export interface ChatMsg { role: 'user' | 'assistant'; content: string }

/* eslint-disable @typescript-eslint/no-explicit-any -- the library is loaded at run time, untyped */
let lib: any = null;
let gen: any = null;
let loading: Promise<void> | null = null;

export const ai = {
  status: 'off' as AiStatus,
  /** 0–100 while downloading. */
  progress: 0,
  error: '',
  /** Bytes the download needs, when known. */
  size: 0,
  busy: false,
};

const enabledFlag = () => { try { return localStorage.getItem(FLAG) === '1'; } catch { return false; } };
const setFlag = (on: boolean) => { try { if (on) localStorage.setItem(FLAG, '1'); else localStorage.removeItem(FLAG); } catch { /* private mode */ } };
/** Whether the user turned the assistant on (it may still need loading). */
export const aiEnabled = () => enabledFlag();

function set(p: Partial<typeof ai>) { Object.assign(ai, p); emit(); }

/** WebGPU is what makes the model fast enough. Without it, it would take minutes per answer. */
export async function webgpuOk(): Promise<boolean> {
  try {
    const gpu = (navigator as any).gpu;
    if (!gpu) return false;
    return !!(await gpu.requestAdapter());
  } catch { return false; }
}

async function loadLib() {
  // Loaded from the web at run time, not bundled into Dayline: it is large and only needed here.
  if (!lib) lib = await (new Function('u', 'return import(u)'))(LIB);
  lib.env.useBrowserCache = true;
  lib.env.allowLocalModels = false;
  return lib;
}

/** Size of the download, for the button in Settings. */
export async function downloadSize(): Promise<number> {
  try {
    const L = await loadLib();
    const files: string[] = await L.ModelRegistry.get_pipeline_files(TASK, MODEL, { dtype: 'q4f16', device: 'webgpu' });
    const sizes = await Promise.all(files.map((f) => L.ModelRegistry.get_file_metadata(MODEL, f).then((m: any) => m?.size || 0).catch(() => 0)));
    const total = sizes.reduce((a: number, b: number) => a + b, 0);
    if (total) set({ size: total });
    return total;
  } catch { return 0; }
}

/** Downloads (first time) or opens (later) the model. Safe to call many times. */
export function startAi(): Promise<void> {
  if (gen) { set({ status: 'ready' }); return Promise.resolve(); }
  if (loading) return loading;
  loading = (async () => {
    if (!(await webgpuOk())) { set({ status: 'unsupported' }); loading = null; return; }
    set({ status: 'loading', progress: 0, error: '' });
    try {
      const L = await loadLib();
      const cached = await L.ModelRegistry.is_pipeline_cached(TASK, MODEL, { dtype: 'q4f16', device: 'webgpu' }).catch(() => false);
      if (!cached) set({ status: 'downloading' });
      gen = await L.pipeline(TASK, MODEL, {
        dtype: 'q4f16', device: 'webgpu',
        progress_callback: (i: any) => {
          if (i.status === 'progress_total' && typeof i.progress === 'number') {
            const p = Math.floor(i.progress);
            if (p !== ai.progress) set({ progress: p, ...(i.total ? { size: i.total } : {}) });
          }
        },
      });
      setFlag(true);
      set({ status: 'ready', progress: 100 });
      navigator.storage?.persist?.().catch(() => {});
    } catch (e) {
      gen = null;
      const msg = String((e as Error)?.message || e);
      set({ status: 'error', error: /quota|space|storage/i.test(msg) ? 'Not enough free space on this phone for the AI model.'
        : !navigator.onLine ? 'The download needs the internet. Connect and try again; it continues where it stopped.'
        : 'The AI model could not start. ' + msg.slice(0, 160) });
    }
    loading = null;
  })();
  return loading;
}

/** Turns the assistant off and frees the space it used. */
export async function removeAi() {
  setFlag(false);
  try { await gen?.dispose?.(); } catch { /* already gone */ }
  gen = null;
  try { const L = await loadLib(); await L.ModelRegistry.clear_pipeline_cache(TASK, MODEL, { dtype: 'q4f16', device: 'webgpu' }); } catch { /* nothing cached */ }
  set({ status: 'off', progress: 0, error: '' });
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
  // Gemma has no separate "system" turn: the instructions open the first message.
  const msgs = chat.map((m, i) => (i === 0 && m.role === 'user' ? { role: 'user', content: instructions + '\n\n' + m.content } : m));
  let text = '';
  stopper = new L.InterruptableStoppingCriteria();
  const streamer = new L.TextStreamer(gen.tokenizer, {
    skip_prompt: true, skip_special_tokens: true,
    callback_function: (s: string) => { text += s; onText(text); },
  });
  set({ busy: true });
  try {
    const out = await gen(msgs, {
      max_new_tokens: maxTokens, do_sample: false, streamer,
      stopping_criteria: stopper,
      tokenizer_encode_kwargs: { enable_thinking: false },
    });
    const full = out?.[0]?.generated_text;
    const last = Array.isArray(full) ? full.at(-1)?.content : full;
    return (typeof last === 'string' && last.trim()) ? last.trim() : text.trim();
  } finally { stopper = null; set({ busy: false }); }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
