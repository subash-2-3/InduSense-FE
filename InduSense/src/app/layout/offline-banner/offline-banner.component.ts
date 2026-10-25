import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../core/auth/auth.service';
import { Permission } from '../../core/auth/permissions';
import { ConnectivityService, StreamIssue } from '../../core/connectivity/connectivity.service';
import { IconComponent } from '../../shared/ui';

/** How long "connection restored" stays up. */
export const RESTORED_NOTICE_MS = 4000;

/**
 * Sticky connectivity banner at the top of the page content. Shows the worst problem only:
 * no network (critical) > API server unreachable (critical, with reconnect attempts) > a DataLogger
 * that lost its MQTT broker / PLC connection (warning). Nothing is shown while all is well, apart
 * from a short "restored" notice after a recovery.
 */
@Component({
  selector: 'app-offline-banner',
  imports: [IconComponent],
  template: `
    @switch (connectivity.status()) {
      @case ('offline') {
        <div class="banner banner--critical" role="alert">
          <app-icon name="wifi-off" [size]="16" />
          <p class="banner__text">
            <strong>You're offline.</strong>
            Live values are paused and refresh once the connection is back.
          </p>
        </div>
      }
      @case ('server-down') {
        <div class="banner banner--critical" role="alert">
          <app-icon name="alert-triangle" [size]="16" />
          <p class="banner__text">
            <strong>Can't reach the InduSense server</strong> ({{ serverReason() }}).
            <span class="banner__detail" aria-live="polite">{{ reconnectText() }}</span>
          </p>
          <button type="button" class="banner__action" (click)="connectivity.retryNow()">
            <app-icon name="refresh" [size]="14" /> Retry now
          </button>
        </div>
      }
      @case ('stream-degraded') {
        <div class="banner banner--warning" role="status">
          <span class="banner__spinner" aria-hidden="true"></span>
          <p class="banner__text">
            <strong>Live data interrupted.</strong>
            {{ streamText() }}
            <span class="banner__detail">
              Values may be out of date · check {{ connectivity.streamChecks() }}
            </span>
          </p>
        </div>
      }
      @default {
        @if (restoredNotice()) {
          <div class="banner banner--ok" role="status">
            <app-icon name="check" [size]="16" />
            <p class="banner__text">{{ restoredNotice() }}</p>
          </div>
        }
      }
    }
  `,
  styles: `
    :host {
      position: sticky;
      top: 0;
      z-index: calc(var(--z-topbar) - 1);
      display: block;
    }
    .banner {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      border-bottom: 1px solid;
      font-size: var(--fs-sm);
      color: var(--text-primary);
    }
    .banner--critical {
      background: var(--status-fault-soft);
      border-color: var(--status-fault);
    }
    .banner--critical app-icon {
      color: var(--status-fault-text);
    }
    .banner--warning {
      background: var(--status-warning-soft);
      border-color: var(--status-warning);
    }
    .banner--ok {
      background: var(--status-running-soft);
      border-color: var(--status-running);
    }
    .banner__text {
      flex: 1;
      margin: 0;
      min-width: 0;
    }
    .banner__detail {
      color: var(--text-secondary);
      margin-left: var(--space-1);
    }
    .banner__action {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      flex-shrink: 0;
      height: 28px;
      padding: 0 10px;
      border: 1px solid var(--status-fault);
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--status-fault-text);
      font-weight: var(--fw-semibold);
      cursor: pointer;
    }
    .banner__action:focus-visible {
      outline: 2px solid var(--accent-cyan);
      outline-offset: 1px;
    }
    .banner__spinner {
      flex-shrink: 0;
      width: 14px;
      height: 14px;
      border: 2px solid var(--status-warning);
      border-right-color: transparent;
      border-radius: 50%;
      animation: banner-spin 0.9s linear infinite;
    }
    @keyframes banner-spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .banner__spinner {
        animation: none;
      }
    }
    @media print {
      :host {
        display: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfflineBannerComponent {
  protected readonly connectivity = inject(ConnectivityService);
  private readonly auth = inject(AuthService);

  /** Ticks every second while a reconnect is scheduled, for the countdown. */
  private readonly now = signal(Date.now());
  protected readonly restoredNotice = signal<string | null>(null);

  protected readonly serverReason = computed(() => {
    const status = this.connectivity.serverStatus();
    if (status === 0 || status === null) return 'no response';
    if (status === 503) return 'service unavailable';
    return status === 504 ? 'gateway timeout' : `error ${status}`;
  });

  protected readonly reconnectText = computed(() => {
    const attempts = this.connectivity.probeAttempts();
    const next = this.connectivity.nextProbeAt();
    if (!next) return attempts ? `Reconnecting… (attempt ${attempts})` : 'Reconnecting…';
    const seconds = Math.max(0, Math.ceil((next.getTime() - this.now()) / 1000));
    const tried = attempts ? ` · ${attempts} attempt${attempts === 1 ? '' : 's'} so far` : '';
    return `Retrying in ${seconds}s${tried}.`;
  });

  protected readonly streamText = computed(() => describeIssues(this.connectivity.streamIssues()));

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Only users who may read DataLogger heartbeats watch the stream.
    effect((onCleanup) => {
      if (this.auth.isAuthenticated() && this.auth.hasPermission(Permission.LoggersView)) {
        onCleanup(this.connectivity.watchStream());
      }
    });

    effect((onCleanup) => {
      if (!this.connectivity.nextProbeAt()) return;
      this.now.set(Date.now());
      const tick = setInterval(() => this.now.set(Date.now()), 1000);
      onCleanup(() => clearInterval(tick));
    });

    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    this.connectivity.restored$.pipe(takeUntilDestroyed()).subscribe((kind) => {
      this.restoredNotice.set(
        kind === 'stream' ? 'Live data is flowing again.' : 'Connection restored.',
      );
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => this.restoredNotice.set(null), RESTORED_NOTICE_MS);
    });
    destroyRef.onDestroy(() => {
      if (hideTimer) clearTimeout(hideTimer);
    });
  }
}

function describeIssues(issues: readonly StreamIssue[]): string {
  if (issues.length === 0) return '';
  if (issues.length > 1) {
    return `${issues.length} DataLoggers are not receiving data; waiting for them to reconnect.`;
  }
  const [issue] = issues;
  const reason = issue.lastError ? ` (${issue.lastError})` : '';
  return issue.kind === 'stale'
    ? `DataLogger ${issue.hostname} stopped reporting${reason}.`
    : `DataLogger ${issue.hostname} lost its broker / device connection${reason}; waiting for it to reconnect.`;
}
