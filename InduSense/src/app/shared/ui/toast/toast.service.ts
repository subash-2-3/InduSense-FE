import { Injectable, signal } from '@angular/core';

import { ApiError } from '../../../core/api/api-error';

export type ToastType = 'success' | 'error';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

const DURATION_MS: Readonly<Record<ToastType, number>> = { success: 4000, error: 8000 };
const MAX_VISIBLE = 4;

/**
 * User-facing notifications for the outcome of an action (saved, deleted, failed).
 * Errors take the ApiError itself, so the backend's message and field details reach the user.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly items = signal<readonly Toast[]>([]);
  private nextId = 1;

  readonly toasts = this.items.asReadonly();

  success(message: string): void {
    this.show('success', message);
  }

  /** An error (usually an ApiError) or a message. `fallback` is used when the error has no message. */
  error(error: unknown, fallback = 'Something went wrong. Please try again.'): void {
    this.show('error', errorMessage(error, fallback));
  }

  dismiss(id: number): void {
    this.items.update((list) => list.filter((t) => t.id !== id));
  }

  private show(type: ToastType, message: string): void {
    const id = this.nextId++;
    this.items.update((list) => [...list, { id, type, message }].slice(-MAX_VISIBLE));
    setTimeout(() => this.dismiss(id), DURATION_MS[type]);
  }
}

/**
 * What to tell the user about a failed request: the backend's message, made specific by the first
 * rejected field for validation errors, and a reference for unexpected server errors.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string') {
    return error || fallback;
  }
  if (!(error instanceof ApiError)) {
    return error instanceof Error && error.message ? error.message : fallback;
  }
  const detail = error.details[0];
  if (detail?.message) {
    const field = (detail.field ?? '').split('.').pop();
    return field && field !== 'body' ? `${field}: ${detail.message}` : detail.message;
  }
  const message = error.message || fallback;
  return error.status >= 500 && error.requestId ? `${message} (ref. ${error.requestId})` : message;
}
