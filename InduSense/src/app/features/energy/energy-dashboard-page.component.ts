import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  combineLatest,
  distinctUntilChanged,
  exhaustMap,
  finalize,
  fromEvent,
  map,
  of,
  startWith,
  switchMap,
  tap,
  timer,
} from 'rxjs';

import { ApiError } from '../../core/api/api-error';
import { EnergyApi } from '../../core/api/resources/energy.api';
import { AuthService } from '../../core/auth/auth.service';
import { Permission } from '../../core/auth/permissions';
import {
  EnergyDistribution,
  EnergyGroupBy,
  EnergyLive,
  EnergyOverview,
  EnergyTrends,
  LiveAsset,
} from '../../core/models';
import { ChartThemeService } from '../../shared/charts/chart-theme.service';
import { EchartDirective } from '../../shared/charts/echart.directive';
import {
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  IconComponent,
  SkeletonComponent,
  StatusPillComponent,
  StatusTone,
} from '../../shared/ui';
import { formatDateTime, formatRelativeTime } from '../../shared/utils/format';
import { injectNow } from '../../shared/utils/now';
import {
  DistributionChart,
  METRIC_LABELS,
  buildDistributionOptions,
  buildTrendOptions,
  formatKpi,
  formatQuantity,
  formatValue,
  groupTagsByUnit,
  trendTitle,
} from './energy-charts';
import { EnergyFilterState, EnergyFiltersComponent } from './energy-filters.component';
import { TimeRange, rangeFor } from './energy-range';

/** Live values refresh this often while the tab is visible. */
export const LIVE_REFRESH_MS = 10_000;
/** Range data (KPIs, trends, distribution) refresh this often for "Today". */
export const RANGE_REFRESH_MS = 60_000;

const ASSET_TONE: Readonly<Record<string, StatusTone>> = {
  ONLINE: 'running',
  OFFLINE: 'fault',
  NO_DATA: 'stopped',
};

const GROUP_OPTIONS: readonly { value: EnergyGroupBy; label: string }[] = [
  { value: 'meter', label: 'Meter' },
  { value: 'machine', label: 'Machine' },
  { value: 'area', label: 'Area' },
  { value: 'plant', label: 'Plant' },
];

function message(error: unknown): string {
  return ApiError.from(error).message;
}

@Component({
  selector: 'app-energy-dashboard-page',
  imports: [
    RouterLink,
    EchartDirective,
    EnergyFiltersComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    IconComponent,
    SkeletonComponent,
    StatusPillComponent,
  ],
  template: `
    <div class="energy">
      <header class="energy__header">
        <div>
          <h1 class="energy__title">Energy Dashboard</h1>
          <p class="energy__subtitle">
            Live values and trends of the energy parameters mapped to your meters and machines
          </p>
        </div>
        <div class="energy__actions">
          @if (live(); as l) {
            <span class="energy__updated" aria-live="polite"
              >Updated {{ relative(l.generated_at) }}</span
            >
          }
          @if (canViewReports()) {
            <a appButton variant="secondary" routerLink="/energy/reports">
              <app-icon name="line-chart" [size]="14" /> Energy reports
            </a>
          }
          <button appButton variant="secondary" (click)="refresh()" [loading]="rangeLoading()">
            <app-icon name="refresh" [size]="14" /> Refresh
          </button>
        </div>
      </header>

      <app-card>
        <app-energy-filters (changed)="onFilters($event)" />
      </app-card>

      <!-- Summary ------------------------------------------------------------ -->
      <section aria-labelledby="energy-summary">
        <h2 id="energy-summary" class="sr-only">Summary</h2>
        @if (overviewError(); as err) {
          <app-card
            ><app-error-state heading="Summary unavailable" [message]="err" (retry)="refresh()"
          /></app-card>
        } @else if (overview(); as o) {
          <div class="kpis">
            <div class="kpi">
              <span class="kpi__label">Total energy</span>
              <span class="kpi__value">{{ quantity(o.summary.total_energy) }}</span>
            </div>
            <div class="kpi">
              <span class="kpi__label">Average power</span>
              <span class="kpi__value">{{ kpi(o.summary.average_power) }}</span>
            </div>
            <div class="kpi">
              <span class="kpi__label">Peak power</span>
              <span class="kpi__value">{{ kpi(o.summary.peak_power) }}</span>
            </div>
            <div class="kpi">
              <span class="kpi__label">Minimum power</span>
              <span class="kpi__value">{{ kpi(o.summary.minimum_power) }}</span>
            </div>
            <div class="kpi">
              <span class="kpi__label">Avg power factor</span>
              <span class="kpi__value">{{ kpi(o.summary.average_power_factor) }}</span>
            </div>
            <div class="kpi">
              <span class="kpi__label">Avg voltage</span>
              <span class="kpi__value">{{ kpi(o.summary.average_voltage) }}</span>
            </div>
            <div class="kpi">
              <span class="kpi__label">Avg current</span>
              <span class="kpi__value">{{ kpi(o.summary.average_current) }}</span>
            </div>
            <div class="kpi">
              <span class="kpi__label">Meters online</span>
              <span class="kpi__value">
                <span class="text-ok">{{ o.summary.active_meters }}</span> / {{ o.summary.meters }}
              </span>
            </div>
          </div>
          @if (o.metadata.notes.length) {
            <ul class="notes">
              @for (n of o.metadata.notes; track n) {
                <li>{{ n }}</li>
              }
            </ul>
          }
        } @else {
          <div class="kpis">
            @for (i of [1, 2, 3, 4]; track i) {
              <app-skeleton height="68px" />
            }
          </div>
        }
      </section>

      <!-- Live --------------------------------------------------------------- -->
      <section aria-labelledby="energy-live" class="section">
        <h2 id="energy-live" class="section__title">Live values</h2>
        @if (liveError(); as err) {
          <app-card
            ><app-error-state heading="Live values unavailable" [message]="err" (retry)="refresh()"
          /></app-card>
        } @else if (live(); as l) {
          @if (l.assets.length) {
            <div class="live-grid">
              @for (a of l.assets; track a.asset_type + a.asset_id) {
                <app-card>
                  <div class="asset">
                    <div class="asset__head">
                      <div>
                        <h3 class="asset__name">{{ a.name }}</h3>
                        <p class="asset__meta">{{ assetMeta(a) }}</p>
                      </div>
                      <app-status-pill
                        dot
                        [label]="statusLabel(a.status)"
                        [tone]="tone(a.status)"
                      />
                    </div>
                    <dl class="params">
                      @for (p of a.parameters; track p.tag_id) {
                        <div class="param" [class.param--stale]="p.connection_state !== 'ONLINE'">
                          <dt class="param__name" [title]="metricLabel(p.metric)">{{ p.name }}</dt>
                          <dd class="param__value">{{ value(p.value, p.unit) }}</dd>
                        </div>
                      }
                    </dl>
                    <p class="asset__time">
                      Last data: {{ a.last_data_at ? dateTime(a.last_data_at) : 'never' }}
                    </p>
                  </div>
                </app-card>
              }
            </div>
          } @else {
            <app-card>
              <app-empty-state
                heading="No energy parameters"
                message="Map tags to a meter or machine as Power, Energy, Voltage, Current, Frequency or Power factor (Assets → Tags) to see them here."
              />
            </app-card>
          }
        } @else {
          <div class="live-grid">
            <app-skeleton height="180px" /><app-skeleton height="180px" />
          </div>
        }
      </section>

      <!-- Trends ------------------------------------------------------------- -->
      <section aria-labelledby="energy-trends" class="section">
        <div class="section__head">
          <h2 id="energy-trends" class="section__title">Trends</h2>
          @if (tagGroups().length) {
            <details class="picker">
              <summary class="picker__button">
                Parameters ({{ selectedTags() ? selectedTags()!.length : 'all' }})
                <app-icon name="chevron-down" [size]="14" />
              </summary>
              <div class="picker__panel">
                <button type="button" class="picker__all" (click)="selectAllTags()">
                  Show all
                </button>
                @for (g of tagGroups(); track g.unit) {
                  <fieldset class="picker__group">
                    <legend>{{ g.unit }}</legend>
                    @for (t of g.tags; track t.tag_id) {
                      <label class="picker__item">
                        <input
                          type="checkbox"
                          [checked]="isSelected(t.tag_id)"
                          (change)="toggleTag(t.tag_id)"
                        />
                        {{ t.name }}
                      </label>
                    }
                  </fieldset>
                }
              </div>
            </details>
          }
        </div>
        @if (trendsError(); as err) {
          <app-card
            ><app-error-state heading="Trends unavailable" [message]="err" (retry)="refresh()"
          /></app-card>
        } @else if (trends(); as t) {
          @if (t.groups.length) {
            <div class="trend-grid">
              @for (c of trendCharts(); track c.key) {
                <app-card [heading]="c.title">
                  <div
                    class="chart"
                    role="img"
                    [attr.aria-label]="c.title"
                    [appEchart]="c.options"
                  ></div>
                </app-card>
              }
            </div>
          } @else {
            <app-card
              ><app-empty-state
                heading="No trend data"
                message="No samples for the selected parameters in this period."
            /></app-card>
          }
        } @else {
          <app-skeleton height="260px" />
        }
      </section>

      <!-- Distribution and meters --------------------------------------------- -->
      <div class="split">
        <section aria-labelledby="energy-distribution" class="section">
          <div class="section__head">
            <h2 id="energy-distribution" class="section__title">Energy distribution</h2>
            <div class="section__tools">
              <select
                class="select"
                aria-label="Group by"
                [value]="groupBy()"
                (change)="setGroupBy($any($event.target).value)"
              >
                @for (o of groupOptions; track o.value) {
                  <option [value]="o.value">By {{ o.label.toLowerCase() }}</option>
                }
              </select>
              <div class="toggle" role="radiogroup" aria-label="Chart type">
                @for (c of chartTypes; track c) {
                  <button
                    type="button"
                    role="radio"
                    class="toggle__item"
                    [class.toggle__item--active]="chart() === c"
                    [attr.aria-checked]="chart() === c"
                    (click)="chart.set(c)"
                  >
                    {{ c === 'pie' ? 'Pie' : 'Bar' }}
                  </button>
                }
              </div>
            </div>
          </div>
          <app-card>
            @if (distributionError(); as err) {
              <app-error-state
                heading="Distribution unavailable"
                [message]="err"
                (retry)="refresh()"
              />
            } @else if (distribution(); as d) {
              @if (d.items.length) {
                <div
                  class="chart chart--tall"
                  role="img"
                  [attr.aria-label]="distributionSummary()"
                  [appEchart]="distributionOptions()"
                  (sizeChange)="distWidth.set($event.width)"
                ></div>
                <p class="total">Total: {{ quantity(d.total) }}</p>
              } @else {
                <app-empty-state
                  compact
                  heading="No consumption"
                  [message]="d.metadata.notes[0] || 'No energy consumed in this period.'"
                />
              }
            } @else {
              <app-skeleton height="240px" />
            }
          </app-card>
        </section>

        <section aria-labelledby="energy-meters" class="section">
          <h2 id="energy-meters" class="section__title">Meters</h2>
          <app-card [padded]="false">
            @if (overview(); as o) {
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th scope="col">Meter</th>
                      <th scope="col">Location</th>
                      <th scope="col">Status</th>
                      <th scope="col" class="num">Power</th>
                      <th scope="col">Last data</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (m of o.meters; track m.asset_id) {
                      <tr>
                        <td>
                          <strong>{{ m.name }}</strong>
                          <div class="mono">{{ m.code }}</div>
                        </td>
                        <td>{{ m.plant_name }}{{ m.area_name ? ' · ' + m.area_name : '' }}</td>
                        <td>
                          <app-status-pill
                            dot
                            [label]="statusLabel(m.status)"
                            [tone]="tone(m.status)"
                          />
                        </td>
                        <td class="num mono">{{ kpi(m.latest_power) }}</td>
                        <td>{{ m.last_data_at ? relative(m.last_data_at) : '—' }}</td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="5" class="empty">No meters with energy parameters.</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <div class="pad"><app-skeleton height="120px" /></div>
            }
          </app-card>
        </section>
      </div>
    </div>
  `,
  styleUrls: ['./energy.scss', './energy-dashboard.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnergyDashboardPageComponent {
  private readonly api = inject(EnergyApi);
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly theme = inject(ChartThemeService).current;
  private readonly now = injectNow(5000);

  protected readonly groupOptions = GROUP_OPTIONS;
  protected readonly chartTypes: readonly DistributionChart[] = ['pie', 'bar'];
  protected readonly canViewReports = computed(() =>
    this.auth.hasPermission(Permission.ReportsView),
  );

  protected readonly overview = signal<EnergyOverview | null>(null);
  protected readonly overviewError = signal<string | null>(null);
  protected readonly live = signal<EnergyLive | null>(null);
  protected readonly liveError = signal<string | null>(null);
  protected readonly trends = signal<EnergyTrends | null>(null);
  protected readonly trendsError = signal<string | null>(null);
  protected readonly distribution = signal<EnergyDistribution | null>(null);
  protected readonly distributionError = signal<string | null>(null);
  protected readonly rangeLoading = signal(false);

  protected readonly groupBy = signal<EnergyGroupBy>('meter');
  protected readonly chart = signal<DistributionChart>('pie');
  protected readonly distWidth = signal(0);
  /** null = every energy tag in the selection. */
  protected readonly selectedTags = signal<number[] | null>(null);

  protected readonly trendCharts = computed(() =>
    (this.trends()?.groups ?? []).map((g) => ({
      key: `${g.kind}|${g.unit ?? ''}`,
      title: trendTitle(g),
      options: buildTrendOptions(g, this.theme()),
    })),
  );
  protected readonly tagGroups = computed(() =>
    groupTagsByUnit(this.trends()?.available_tags ?? []),
  );
  protected readonly distributionOptions = computed(() =>
    buildDistributionOptions(
      this.distribution()?.items ?? [],
      this.chart(),
      this.theme(),
      this.distWidth() > 0 && this.distWidth() < 420,
    ),
  );
  protected readonly distributionSummary = computed(() => {
    const d = this.distribution();
    return d
      ? `Energy by ${d.group_by}: ${d.items.map((i) => `${i.name} ${formatValue(i.value, i.unit)}`).join(', ')}`
      : '';
  });

  private filters: EnergyFilterState | null = null;
  private readonly filters$ = new Subject<EnergyFilterState>();
  private readonly refresh$ = new Subject<void>();
  private readonly trends$ = new Subject<void>();
  private readonly distribution$ = new Subject<void>();

  constructor() {
    const visible$ = fromEvent(this.document, 'visibilitychange').pipe(
      startWith(null),
      map(() => this.document.visibilityState !== 'hidden'),
      distinctUntilChanged(),
    );

    // Live values: now, then every LIVE_REFRESH_MS while visible.
    combineLatest([this.filters$, visible$, this.refresh$.pipe(startWith(undefined))])
      .pipe(
        switchMap(([filters, visible]) =>
          visible ? timer(0, LIVE_REFRESH_MS).pipe(map(() => filters)) : EMPTY,
        ),
        exhaustMap((filters) =>
          this.api.live(filters.scope).pipe(
            tap(() => this.liveError.set(null)),
            catchError((e) => (this.liveError.set(message(e)), of(null))),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((live) => live && this.live.set(live));

    // KPIs, trends and distribution: on every change; "Today" also every RANGE_REFRESH_MS.
    combineLatest([this.filters$, visible$, this.refresh$.pipe(startWith(undefined))])
      .pipe(
        switchMap(([filters, visible]) =>
          filters.preset === 'today' && visible
            ? timer(0, RANGE_REFRESH_MS).pipe(map(() => filters))
            : of(filters),
        ),
        switchMap(() => this.loadRange()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.trends$
      .pipe(
        switchMap(() => this.loadTrends()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
    this.distribution$
      .pipe(
        switchMap(() => this.loadDistribution()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected onFilters(state: EnergyFilterState): void {
    const scopeChanged = JSON.stringify(state.scope) !== JSON.stringify(this.filters?.scope);
    this.filters = state;
    if (scopeChanged) {
      this.selectedTags.set(null); // tags of another selection
    }
    this.filters$.next(state);
  }

  protected refresh(): void {
    this.refresh$.next();
  }

  protected setGroupBy(value: EnergyGroupBy): void {
    this.groupBy.set(value);
    this.distribution$.next();
  }

  protected isSelected(tagId: number): boolean {
    const selected = this.selectedTags();
    return selected === null || selected.includes(tagId);
  }

  protected toggleTag(tagId: number): void {
    const all = (this.trends()?.available_tags ?? []).map((t) => t.tag_id);
    const current = this.selectedTags() ?? all;
    const next = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    this.selectedTags.set(next.length === 0 || next.length === all.length ? null : next);
    this.trends$.next();
  }

  protected selectAllTags(): void {
    this.selectedTags.set(null);
    this.trends$.next();
  }

  private range(): TimeRange {
    return this.filters ? rangeFor(this.filters.preset, new Date(), this.filters.custom) : {};
  }

  private loadRange(): Observable<unknown> {
    if (!this.filters) {
      return EMPTY;
    }
    this.rangeLoading.set(true);
    const request = { ...this.filters.scope, ...this.range() };
    return combineLatest([
      this.api.overview(request).pipe(
        tap((o) => (this.overview.set(o), this.overviewError.set(null))),
        catchError((e) => (this.overviewError.set(message(e)), of(null))),
      ),
      this.loadTrends(),
      this.loadDistribution(),
    ]).pipe(finalize(() => this.rangeLoading.set(false)));
  }

  private loadTrends(): Observable<unknown> {
    if (!this.filters) {
      return EMPTY;
    }
    const tags = this.selectedTags();
    return this.api
      .trends({ ...this.filters.scope, ...this.range(), ...(tags ? { tag_id: tags } : {}) })
      .pipe(
        tap((t) => (this.trends.set(t), this.trendsError.set(null))),
        catchError((e) => (this.trendsError.set(message(e)), of(null))),
      );
  }

  private loadDistribution(): Observable<unknown> {
    if (!this.filters) {
      return EMPTY;
    }
    return this.api
      .distribution({ ...this.filters.scope, ...this.range(), group_by: this.groupBy() })
      .pipe(
        tap((d) => (this.distribution.set(d), this.distributionError.set(null))),
        catchError((e) => (this.distributionError.set(message(e)), of(null))),
      );
  }

  // ------------------------------------------------------------------ view helpers ----

  protected kpi = formatKpi;
  protected quantity = formatQuantity;
  protected value = formatValue;

  protected metricLabel(metric: string): string {
    return METRIC_LABELS[metric] ?? metric;
  }

  protected tone(status: string): StatusTone {
    return ASSET_TONE[status] ?? 'stopped';
  }

  protected statusLabel(status: string): string {
    return status === 'NO_DATA' ? 'No data' : status.charAt(0) + status.slice(1).toLowerCase();
  }

  protected assetMeta(a: LiveAsset): string {
    const place = [a.plant_name, a.area_name].filter(Boolean).join(' · ');
    return `${a.asset_type === 'meter' ? 'Meter' : 'Machine'} ${a.code}${place ? ' · ' + place : ''}`;
  }

  protected relative(ts: string): string {
    return formatRelativeTime(ts, this.now());
  }

  protected dateTime(ts: string): string {
    return formatDateTime(ts);
  }
}
