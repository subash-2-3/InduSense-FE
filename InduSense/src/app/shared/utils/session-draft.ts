import { WritableSignal, effect, signal } from '@angular/core';

/**
 * sessionStorage-backed drafts for add/edit forms.
 *
 * A half-filled form is saved under a stable key so it survives switching menus (the page unmounts)
 * and comes back when the user returns. State lives for the browser session only and never leaves
 * the device. Sensitive fields (passwords, tokens…) are stripped before anything is written, and
 * every access is guarded so private mode or disabled storage degrades to "no draft".
 */

const SENSITIVE_KEY = /(password|passwd|secret|token|pin|otp|api[_-]?key)/i;

export function sanitizeDraft<T>(value: T): T {
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDraft(item)) as unknown as T;
  }
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (!SENSITIVE_KEY.test(key)) {
      clean[key] = sanitizeDraft(val);
    }
  }
  return clean as T;
}

function store(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readDraft<T>(key: string): T | null {
  const s = store();
  if (!s) {
    return null;
  }
  try {
    const raw = s.getItem(key);
    return raw === null ? null : (sanitizeDraft(JSON.parse(raw)) as T);
  } catch {
    return null;
  }
}

export function writeDraft<T>(key: string, value: T): void {
  const s = store();
  if (!s) {
    return;
  }
  try {
    if (value === undefined || value === null) {
      s.removeItem(key);
    } else {
      s.setItem(key, JSON.stringify(sanitizeDraft(value)));
    }
  } catch {
    // Ignore quota / private-mode write failures.
  }
}

export function clearDraft(key: string): void {
  const s = store();
  if (!s) {
    return;
  }
  try {
    s.removeItem(key);
  } catch {
    // Ignore.
  }
}

/**
 * A writable signal mirrored into sessionStorage, for small UI state that should survive navigation
 * within the session — e.g. whether an add-drawer is open, so returning to the page reopens it.
 * Must be created in an injection context (a component/service field or constructor).
 */
export function persistedSignal<T>(key: string, initial: T): WritableSignal<T> {
  const start = readDraft<T>(key);
  const state = signal<T>(start === null ? initial : start);
  effect(() => writeDraft(key, state()));
  return state;
}
