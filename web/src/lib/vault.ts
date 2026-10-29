'use client';
// Locked notes.
// The PIN is turned into a key with PBKDF2 (310,000 rounds, so guessing is slow), and the notes are
// encrypted with AES-GCM. Only the encrypted text is saved or synced; without the PIN nobody can read it.
// This is the same method as the original Dayline, so the same PIN opens the same notes in both.

import { app, save } from './store';
import type { Note } from '@/types';

export function b64(buf: ArrayBuffer | Uint8Array) {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(u.subarray(i, i + 0x8000)));
  return btoa(s);
}
export const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function deriveKey(pin: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 310000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

/** Encrypts the unlocked notes and saves them. */
export async function sealVault() {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, app.vaultKey!, new TextEncoder().encode(JSON.stringify(app.vaultNotes)));
  app.S.vault = { salt: app.S.vault!.salt, iv: b64(iv), data: b64(ct), count: app.vaultNotes.length };
  await save();
}

export async function createVault(pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  app.vaultKey = await deriveKey(pin, salt);
  app.S.vault = { salt: b64(salt) };
  await sealVault();
}

/** Changes the PIN: same notes, new key. */
export async function changePin(pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  app.vaultKey = await deriveKey(pin, salt);
  app.S.vault!.salt = b64(salt);
  await sealVault();
}

/** Returns true if the PIN was right; the notes are then unlocked. */
export async function openVault(pin: string) {
  const v = app.S.vault!;
  const key = await deriveKey(pin, unb64(v.salt));
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(v.iv!) as BufferSource }, key, unb64(v.data!) as BufferSource);
    app.vaultKey = key;
    app.vaultNotes = JSON.parse(new TextDecoder().decode(pt)) as Note[];
    return true;
  } catch { return false; }
}

/** Re-reads the locked notes after another device changed them (same PIN). */
export async function reopenWithKey() {
  const v = app.S.vault;
  if (!app.vaultKey || !v?.data) { lockVault(); return; }
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(v.iv!) as BufferSource }, app.vaultKey, unb64(v.data) as BufferSource);
    app.vaultNotes = JSON.parse(new TextDecoder().decode(pt));
  } catch { lockVault(); }
}

export function lockVault() { app.vaultKey = null; app.vaultNotes = []; }
