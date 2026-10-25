import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';

import { ApiError } from '../api/api-error';
import { LoggersApi } from '../api/resources/admin.api';
import { APP_CONFIG } from '../config/app-config';
import { LoggerStatus } from '../models';

/** HTTP statuses that mean "the API cannot be reached", not "the request was wrong". */
export const UNREACHABLE_STATUSES: ReadonlySet<number> = new Set([0, 502, 503, 504]);

/** Waits between server probes while it is unreachable (seconds); the last one repeats. */
export const PROBE_BACKOFF_SECONDS = [2, 4, 8, 16, 30] as const;
/** DataLogger checks: normally, and while a logger has lost its data source. */
export const STREAM_CHECK_SECONDS = { normal: 30, degraded: 10 } as const;

/** A DataLogger that is not delivering live data. */
export interface StreamIssue {
  loggerId: string;
  hostname: string;
  /** `source`: lost its broker / PLC connection; `stale`: stopped reporting at all. */
  kind: 'source' | 'stale';
  lastError: string | null;
}

export type ConnectivityStatus = 'offline' | 'server-down' | 'stream-degraded' | 'ok';
export type RestoredKind = 'network' | 'server' | 'stream';

/**
 * Connectivity as the user experiences it, worst first:
 *
 * 1. **Network**: the browser's `online` / `offline` events.
 * 2. **API server**: reported by `connectivityInterceptor` (status 0, 502, 503, 504). While it is down
 *    the service probes it with backoff, outside the interceptor chain, until it answers again.
 * 3. **Live data stream**: telemetry reaches the platform through the DataLogger, which holds the
 *    MQTT broker / Modbus connection (the browser has none). Its heartbeat (`/loggers`) says whether it
 *    is still connected to its source; that is polled, faster while a logger is disconnected.
 *
 * `restored$` fires when a level recovers, so views in an error state can retry on their own.
 * Inert during server rendering.
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly document = inject(DOCUMENT);
  private readonly loggersApi = inject(LoggersApi);
  private readonly apiBaseUrl = inject(APP_CONFIG).apiBaseUrl.replace(/\/+$/, '');
  /** Bypasses every interceptor: a probe must not toast, refresh sessions or report itself. */
  private readonly rawHttp = new HttpClient(inject(HttpBackend));

  private readonly onlineState = signal(
    this.isBrowser ? this.document.defaultView?.navigator.onLine !== false : true,
  );
  private readonly serverDownState = signal(false);
  private readonly serverStatusCode = signal<number | null>(null);
  private readonly probeAttemptsState = signal(0);
  private readonly nextProbeAtState = signal<Date | null>(null);
  private readonly streamIssuesState = signal<readonly StreamIssue[]>([]);
  private readonly streamChecksState = signal(0);

  readonly online = this.onlineState.asReadonly();
  readonly serverDown = this.serverDownState.asReadonly();
  /** Last unreachable status (0 = no answer at all). */
  readonly serverStatus = this.serverStatusCode.asReadonly();
  /** Probes since the server became unreachable. */
  readonly probeAttempts = this.probeAttemptsState.asReadonly();
  readonly nextProbeAt = this.nextProbeAtState.asReadonly();
  readonly streamIssues = this.streamIssuesState.asReadonly();
  /** Checks since a DataLogger lost its source (0 while every logger is connected). */
  readonly streamChecks = this.streamChecksState.asReadonly();

  readonly status = computed<ConnectivityStatus>(() => {
    if (!this.onlineState()) return 'offline';
    if (this.serverDownState()) return 'server-down';
    return this.streamIssuesState().length ? 'stream-degraded' : 'ok';
  });

  private readonly restored = new Subject<RestoredKind>();
  readonly restored$ = this.restored.asObservable();

  private probeTimer: ReturnType<typeof setTimeout> | null = null;
  private probing = false;
  private streamTimer: ReturnType<typeof setTimeout> | null = null;
  private streamWatchers = 0;

  constructor() {
    if (!this.isBrowser) return;
    const win = this.document.defaultView!;
    const goOnline = () => {
      this.onlineState.set(true);
      this.restored.next('network');
      if (this.serverDownState()) this.retryNow(); // the network is back; is the server?
      if (this.streamWatchers) this.scheduleStreamCheck(0);
    };
    const goOffline = () => this.onlineState.set(false);
    win.addEventListener('online', goOnline);
    win.addEventListener('offline', goOffline);
    inject(DestroyRef).onDestroy(() => {
      win.removeEventListener('online', goOnline);
      win.removeEventListener('offline', goOffline);
      this.clearProbe();
      this.clearStreamCheck();
    });
  }

  // ------------------------------------------------------------------ API server ----

  /** An API request got no usable answer (status 0, 502, 503 or 504). */
  reportServerFailure(status: number): void {
    if (!this.isBrowser || !this.onlineState()) return; // offline explains it already
    this.serverStatusCode.set(status);
    if (this.serverDownState()) return;
    this.serverDownState.set(true);
    this.probeAttemptsState.set(0);
    this.scheduleProbe();
  }

  /** An API request was answered (any status the server itself chose). */
  reportServerOk(): void {
    if (!this.serverDownState()) return;
    this.serverDownState.set(false);
    this.serverStatusCode.set(null);
    this.probeAttemptsState.set(0);
    this.clearProbe();
    this.restored.next('server');
  }

  /** Probe the server now instead of waiting for the next scheduled attempt. */
  retryNow(): void {
    if (!this.isBrowser || !this.serverDownState()) return;
    this.clearProbe();
    this.probe();
  }

  private scheduleProbe(): void {
    this.clearProbe();
    const index = Math.min(this.probeAttemptsState(), PROBE_BACKOFF_SECONDS.length - 1);
    const delayMs = PROBE_BACKOFF_SECONDS[index] * 1000;
    this.nextProbeAtState.set(new Date(Date.now() + delayMs));
    this.probeTimer = setTimeout(() => this.probe(), delayMs);
  }

  private probe(): void {
    if (this.probing || !this.serverDownState()) return;
    if (!this.onlineState()) {
      this.scheduleProbe(); // try again later; going online probes at once
      return;
    }
    this.probing = true;
    this.nextProbeAtState.set(null);
    this.probeAttemptsState.update((n) => n + 1);
    // Any answer the API itself gives (even 401) means it is reachable; no cookies are sent.
    this.rawHttp.get(`${this.apiBaseUrl}/auth/me`, { observe: 'response' }).subscribe({
      next: () => this.afterProbe(true),
      error: (error: unknown) =>
        this.afterProbe(
          !(error instanceof HttpErrorResponse) || !UNREACHABLE_STATUSES.has(error.status),
        ),
    });
  }

  private afterProbe(reachable: boolean): void {
    this.probing = false;
    if (reachable) this.reportServerOk();
    else if (this.serverDownState()) this.scheduleProbe();
  }

  private clearProbe(): void {
    if (this.probeTimer !== null) clearTimeout(this.probeTimer);
    this.probeTimer = null;
    this.nextProbeAtState.set(null);
  }

  // ---------------------------------------------------------- DataLogger stream ----

  /**
   * Watch the DataLoggers' source connections until the returned function is called. Callers must
   * hold `loggers:view`. Several watchers share one poll.
   */
  watchStream(): () => void {
    if (!this.isBrowser) return () => undefined;
    this.streamWatchers++;
    if (this.streamWatchers === 1) this.scheduleStreamCheck(0);
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      this.streamWatchers--;
      if (this.streamWatchers === 0) {
        this.clearStreamCheck();
        this.streamIssuesState.set([]);
        this.streamChecksState.set(0);
      }
    };
  }

  private scheduleStreamCheck(delayMs: number): void {
    this.clearStreamCheck();
    this.streamTimer = setTimeout(() => this.checkStream(), delayMs);
  }

  private nextStreamCheck(): void {
    if (!this.streamWatchers) return;
    const seconds = this.streamIssuesState().length
      ? STREAM_CHECK_SECONDS.degraded
      : STREAM_CHECK_SECONDS.normal;
    this.scheduleStreamCheck(seconds * 1000);
  }

  private checkStream(): void {
    this.streamTimer = null;
    // Nothing to learn while offline or the server is down, nor for a hidden tab.
    if (
      !this.onlineState() ||
      this.serverDownState() ||
      this.document.visibilityState === 'hidden'
    ) {
      this.nextStreamCheck();
      return;
    }
    this.loggersApi.listAll().subscribe({
      next: (loggers) => {
        this.applyStream(loggers);
        this.nextStreamCheck();
      },
      error: (error: unknown) => {
        // 403: this user cannot read loggers; stop asking. Other failures: keep the last picture.
        if (ApiError.from(error).status === 403) return;
        this.nextStreamCheck();
      },
    });
  }

  private applyStream(loggers: readonly LoggerStatus[]): void {
    const issues: StreamIssue[] = loggers
      .filter((l) => l.health === 'STALE' || !l.source_connected)
      .map((l) => ({
        loggerId: l.logger_id,
        hostname: l.hostname,
        kind: l.health === 'STALE' ? 'stale' : 'source',
        lastError: l.last_error,
      }));
    const hadIssues = this.streamIssuesState().length > 0;
    this.streamIssuesState.set(issues);
    if (issues.length) {
      this.streamChecksState.update((n) => n + 1);
    } else {
      this.streamChecksState.set(0);
      if (hadIssues) this.restored.next('stream');
    }
  }

  private clearStreamCheck(): void {
    if (this.streamTimer !== null) clearTimeout(this.streamTimer);
    this.streamTimer = null;
  }
}
