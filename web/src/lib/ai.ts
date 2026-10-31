// The optional AI assistant, powered by Google Gemini (model gemini-3.6-flash).
//
// The user pastes their own Gemini API key in Settings. The key is kept only in this browser's
// storage on this device: it is never written into the app's code, never synced and never put
// in backup files. Dayline is a public website, so a key built into the code could be copied by
// anyone. Questions go straight from this browser to Google; there is no Dayline server between.

import { emit } from './store';

export const MODEL = 'gemini-3.6-flash';
const API = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`;
const KEY = 'dayline-gemini-key';

export interface ChatMsg { role: 'user' | 'assistant'; content: string }

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export const aiKey = () => ls.get(KEY) || '';
/** The assistant is on when a key has been saved on this device. */
export const aiEnabled = () => !!aiKey();
export function setAiKey(k: string | null) { ls.set(KEY, k ? k.trim() : null); emit(); }

/** An error with a message that can be shown to the user as it is (and translated). */
export class AiError extends Error {}

async function failure(res: Response): Promise<AiError> {
  let detail = '';
  try { detail = JSON.stringify(await res.json()); } catch { /* not JSON */ }
  if (res.status === 400 && /API_KEY|api key/i.test(detail)) return new AiError('Google did not accept this key. Check it in Settings.');
  if (res.status === 401 || res.status === 403) return new AiError('Google did not accept this key. Check it in Settings.');
  if (res.status === 429) return new AiError('Gemini is busy, or the free limit for now is used up. Wait a minute and try again.');
  if (res.status >= 500) return new AiError('Gemini is not answering right now. Try again in a moment.');
  return new AiError('The assistant stopped. Try again.');
}

const offline = () => new AiError('The assistant needs the internet. Connect and try again.');

let ctl: AbortController | null = null;
export function stopAi() { ctl?.abort(); }

function body(instructions: string, chat: ChatMsg[], maxTokens: number) {
  return JSON.stringify({
    systemInstruction: { parts: [{ text: instructions }] },
    contents: chat.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    // Little thinking keeps answers quick; thinking does not count towards the answer length.
    generationConfig: { maxOutputTokens: maxTokens, thinkingConfig: { thinkingLevel: 'low' } },
  });
}

/**
 * Asks Gemini and streams the answer: onText gets the whole answer so far each time more arrives.
 * Resolves with the full answer (or what arrived before Stop was tapped).
 */
export async function askAi(instructions: string, chat: ChatMsg[], onText: (s: string) => void, maxTokens = 450): Promise<string> {
  const key = aiKey();
  if (!key) throw new AiError('Add your Gemini key in Settings first.');
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw offline();
  ctl?.abort();
  const my = new AbortController(); ctl = my;
  let text = '';
  try {
    const res = await fetch(`${API}:streamGenerateContent?alt=sse`, {
      method: 'POST', signal: my.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: body(instructions, chat, maxTokens + 2000),
    });
    if (!res.ok || !res.body) throw await failure(res);
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        try {
          const o = JSON.parse(line.slice(5));
          const parts = o?.candidates?.[0]?.content?.parts || [];
          for (const p of parts) if (typeof p.text === 'string' && !p.thought) text += p.text;
          onText(text);
        } catch { /* a line that is not JSON */ }
      }
    }
    return text;
  } catch (e) {
    if (my.signal.aborted) return text;          // the user tapped Stop: keep what arrived
    if (e instanceof AiError) throw e;
    throw typeof navigator !== 'undefined' && !navigator.onLine ? offline() : new AiError('Could not reach Gemini. Check the internet connection and try again.');
  } finally { if (ctl === my) ctl = null; }
}

/** Checks a key with a tiny question before it is saved. Returns '' when it works, else the reason. */
export async function testKey(key: string): Promise<string> {
  try {
    const res = await fetch(`${API}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key.trim() },
      body: body('Reply with the single word OK.', [{ role: 'user', content: 'Test' }], 20),
    });
    if (res.ok) return '';
    return (await failure(res)).message;
  } catch {
    return typeof navigator !== 'undefined' && !navigator.onLine ? offline().message : 'Could not reach Gemini. Check the internet connection and try again.';
  }
}
