import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, exhaustMap, filter, interval, merge, of, Subject, switchMap } from 'rxjs';

import { DashboardsApi } from '../../core/api/resources/dashboards.api';
import { ConnectivityService } from '../../core/connectivity/connectivity.service';
import { DashboardTimeFilters, KpiValue, MeterDashboard } from '../../core/models';
import {
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  IconComponent,
  SkeletonComponent,
  StatusPillComponent,
} from '../../shared/ui';
import { AsyncState, idleState, toAsyncState, viewOf } from '../../shared/utils/async-state';
import { formatDateTime, formatNumber, formatRelativeTime } from '../../shared/utils/format';
import { statusLabel, statusTone } from '../../shared/utils/status-colors';

/** A reading older than this is shown as not live. */
export const READING_STALE_MS = 5 * 60 * 1000;

type ReadingState = 'live' | 'stale' | 'missing';

interface Reading {
  key: string;
  label: string;
  value: string;
  unit: string;
  state: ReadingState;
  at: string | null;
}

/** The five readings, in display order: summary field, label, fallback unit, decimals. */
const READINGS: readonly [keyof MeterDashboard['summary'], string, string, number][] = [
  ['voltage', 'Voltage', 'V', 1],
  ['current', 'Current', 'A', 2],
  ['current_power', 'Power', 'kW', 2],
  ['power_factor', 'Power factor', '', 3],
  ['energy', 'Energy', 'kWh', 2],
];

/**
 * One meter's live readings (voltage, current, kW, power factor, kWh in the range) as a
 * self-contained card. It loads and refreshes its own data (`/dashboards/meters/{id}`), so a failing
 * meter shows its own error and never takes sibling widgets down:
 *
 * - loading: skeleton in the card's shape;
 * - live: the readings, each marked live / stale / missing;
 * - empty: no reading in the range, with "Reset range";
 * - error: the reason, with "Retry"; a failed refresh keeps the last readings, marked out of date.
 *
 * Refreshes every `refreshSeconds` (0 = never), skips refreshes while offline or the server is
 * unreachable, and reloads by itself when connectivity is restored.
 *
 *     <app-meter-widget [meterId]="12" [range]="{ from, to }" (resetRange)="range.set(defaultRange)" />
 */
@Component({
  selector: 'app-meter-widget',
  imports: [
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    IconComponent,
    SkeletonComponent,
    StatusPillComponent,
  ],
  template: `
    <app-card [heading]="title()">
      @if (status(); as s) {
        <app-status-pill cardActions dot [label]="s.label" [tone]="s.tone" />
      }

      @switch (view()) {
        @case ('loading') {
          <div class="readings" aria-busy="true" aria-label="Loading meter readings">
            @for (r of skeletonTiles; track r) {
              <div class="reading reading--skeleton">
                <app-skeleton width="60%" height="12px" />
                <app-skeleton width="80%" height="22px" />
              </div>
            }
          </div>
          <app-skeleton width="40%" height="12px" />
        }
        @case ('error') {
          <app-error-state
            heading="Meter readings unavailable"
            [message]="state().error?.message"
            [retrying]="state().loading"
            (retry)="retry()"
          />
        }
        @case ('empty') {
          <app-empty-state
            icon="clock"
            heading="No readings in this range"
            message="This meter sent no data for the selected shift or period."
          >
            <button appButton size="sm" type="button" (click)="resetRange.emit()">
              <app-icon name="refresh" [size]="14" /> Reset range
            </button>
          </app-empty-state>
        }
        @case ('ready') {
          <dl class="readings">
            @for (r of readings(); track r.key) {
              <div [class]="'reading reading--' + r.state" [attr.title]="r.at">
                <dt class="reading__label">
                  <span class="reading__dot" [attr.aria-label]="readingStateLabel[r.state]"></span>
                  {{ r.label }}
                </dt>
                <dd class="reading__value">
                  {{ r.value }}
                  @if (r.unit) {
                    <span class="reading__unit">{{ r.unit }}</span>
                  }
                </dd>
              </div>
            }
          </dl>
          <p class="footer" [class.footer--stale]="state().stale" aria-live="polite">
            @if (state().stale) {
              <app-icon name="alert-triangle" [size]="12" />
              Not updated: {{ state().error?.message }} · showing data from {{ updatedAt() }}
            } @else {
              Last data {{ lastData() }} · updated {{ updatedAt() }}
            }
          </p>
        }
      }
    </app-card>
  `,
  styles: `
    .readings {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: var(--space-3);
      margin: 0 0 var(--space-3);
    }
    .reading {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
    }
    .reading__label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--fs-xs);
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .reading__dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--status-stopped);
    }
    .reading--live .reading__dot {
      background: var(--status-running);
    }
    .reading--stale .reading__dot {
      background: var(--status-warning);
    }
    .reading__value {
      margin: 0;
      font-size: var(--fs-lg);
      font-weight: var(--fw-semibold);
      font-variant-numeric: tabular-nums;
      color: var(--text-primary);
    }
    .reading--missing .reading__value,
    .reading--stale .reading__value {
      color: var(--text-secondary);
    }
    .reading__unit {
      font-size: var(--fs-xs);
      font-weight: normal;
      color: var(--text-secondary);
    }
    .footer {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      margin: 0;
      font-size: var(--fs-xs);
      color: var(--text-muted);
    }
    .footer--stale {
      color: var(--text-secondary);
    }
    .footer--stale app-icon {
      color: var(--status-warning);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeterWidgetComponent {
  readonly meterId = input.required<number>();
  /** The selected shift or period (`from` / `to`); none = the server's default range. */
  readonly range = input<DashboardTimeFilters>({});
  /** Heading until the meter's own name has loaded. */
  readonly heading = input('Meter');
  /** Seconds between refreshes; 0 disables polling. */
  readonly refreshSeconds = input(30);
  /** "Reset range" in the empty state: the parent picks the default range. */
  readonly resetRange = output<void>();

  private readonly api = inject(DashboardsApi);
  private readonly connectivity = inject(ConnectivityService);
  private readonly retries = new Subject<void>();

  protected readonly state = signal<AsyncState<MeterDashboard>>(idleState());
  protected readonly skeletonTiles = [0, 1, 2, 3, 4];
  protected readonly readingStateLabel: Record<ReadingState, string> = {
    live: 'Live',
    stale: 'Not updated recently',
    missing: 'No value',
  };

  protected readonly view = computed(() =>
    viewOf(this.state(), (d) => READINGS.every(([key]) => d.summary[key]?.value == null)),
  );
  protected readonly title = computed(() => this.state().data?.meter.name ?? this.heading());

  protected readonly status = computed(() => {
    const data = this.state().data;
    if (!data?.device) return null;
    const connection = data.device.connection_state;
    return { label: statusLabel(connection), tone: statusTone(connection) };
  });

  protected readonly readings = computed<Reading[]>(() => {
    const summary = this.state().data?.summary;
    if (!summary) return [];
    const now = Date.now();
    return READINGS.map(([key, label, unit, digits]) => {
      const kpi: KpiValue | null = summary[key];
      const value = kpi?.value ?? null;
      return {
        key,
        label,
        value: formatNumber(value, { maximumFractionDigits: digits }),
        unit: kpi?.unit ?? unit,
        state: readingState(value, kpi?.ts ?? null, key === 'energy', now),
        at: kpi?.ts ? formatDateTime(kpi.ts) : null,
      };
    });
  });

  protected readonly lastData = computed(() => {
    const at = this.state().data?.last_data_at;
    return at ? formatRelativeTime(at) : 'never';
  });
  protected readonly updatedAt = computed(() => formatDateTime(this.state().lastUpdated));

  constructor() {
    const request = toObservable(computed(() => ({ id: this.meterId(), range: this.range() })));
    request
      .pipe(
        switchMap(({ id, range }) => {
          this.state.set(idleState()); // another meter or range: never show the old readings
          const every = this.refreshSeconds();
          const polls =
            every > 0 ? interval(every * 1000).pipe(filter(() => this.reachable())) : EMPTY;
          const reloads = merge(of(null), this.retries, this.connectivity.restored$, polls);
          // exhaustMap: a slow answer is not interrupted by the next tick.
          return reloads.pipe(
            exhaustMap(() => this.api.meter(id, range).pipe(toAsyncState(this.state()))),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.state.set(state));
  }

  protected retry(): void {
    this.retries.next();
  }

  private reachable(): boolean {
    return this.connectivity.status() !== 'offline' && this.connectivity.status() !== 'server-down';
  }
}

/** Energy is a total over the range, so its age does not matter; instant values go stale. */
function readingState(
  value: number | null,
  ts: string | null,
  cumulative: boolean,
  now: number,
): ReadingState {
  if (value === null) return 'missing';
  if (cumulative || !ts) return 'live';
  return now - new Date(ts).getTime() > READING_STALE_MS ? 'stale' : 'live';
}
