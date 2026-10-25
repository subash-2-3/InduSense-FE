import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable, inject, signal } from '@angular/core';

import { ApiError } from '../api/api-error';

/** A failure the user should know about, with how to recover. */
export interface AppFailure {
  /** `update`: a lazy chunk failed to load, usually after a deployment; reloading fixes it. */
  kind: 'runtime' | 'update';
  message: string;
  /** Failures since the panel was last dismissed. */
  count: number;
}

const CHUNK_FAILURE =
  /Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

/** The recovery panel's state (`AppFailurePanelComponent`). */
@Injectable({ providedIn: 'root' })
export class AppFailureService {
  private readonly state = signal<AppFailure | null>(null);
  readonly failure = this.state.asReadonly();

  report(kind: AppFailure['kind'], message: string): void {
    this.state.update((current) => ({
      // An update notice wins: reloading also clears the runtime error.
      kind: current?.kind === 'update' ? 'update' : kind,
      message: current?.kind === 'update' ? current.message : message,
      count: (current?.count ?? 0) + 1,
    }));
  }

  dismiss(): void {
    this.state.set(null);
  }
}

/**
 * Last line of defence for errors no code handled: it logs them and offers a recovery panel instead
 * of leaving a half-rendered page. Window `error` / `unhandledrejection` events reach it through
 * `provideBrowserGlobalErrorListeners()`.
 *
 * Failed HTTP calls are left alone: pages show their own error states, `errorToastInterceptor`
 * toasts failed changes and `connectivityInterceptor` reports unreachable servers.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly failures = inject(AppFailureService);

  handleError(error: unknown): void {
    const cause = unwrap(error);
    if (cause instanceof HttpErrorResponse || cause instanceof ApiError) {
      return;
    }
    console.error(error);
    const text = cause instanceof Error ? cause.message : String(cause);
    if (CHUNK_FAILURE.test(text)) {
      this.failures.report('update', 'A new version of InduSense is available.');
    } else {
      this.failures.report('runtime', 'Something went wrong on this page.');
    }
  }
}

/** The real error behind promise rejections and wrapped errors. */
function unwrap(error: unknown): unknown {
  let current = error;
  for (let i = 0; i < 3 && current && typeof current === 'object'; i++) {
    const next =
      (current as { rejection?: unknown }).rejection ??
      (current as { ngOriginalError?: unknown }).ngOriginalError;
    if (next === undefined) break;
    current = next;
  }
  return current;
}
