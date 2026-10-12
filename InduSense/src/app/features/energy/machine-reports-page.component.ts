import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Observable, Subject, catchError, finalize, map, of, switchMap, tap } from 'rxjs';

import { ApiError } from '../../core/api/api-error';
import { MachineReportsApi } from '../../core/api/resources/machine-reports.api';
import {
  EnergyExportFormat,
  MachineCumulativePage,
  MachineWideDetailsPage,
  WideCell,
  WideColumn,
  MachineExportReport,
  MachineReportSummary,
  MachineSummaryRow,
  Metadata,
} from '../../core/models';
import {
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  IconComponent,
  PaginationComponent,
  SkeletonComponent,
  ToastService,
} from '../../shared/ui';
import { saveBlob } from '../../shared/utils/download';
import { formatDateTime, formatDuration } from '../../shared/utils/format';
import { formatQuantity, formatValue } from './energy-charts';
import { EnergyFilterState, EnergyFiltersComponent } from './energy-filters.component';
import { customRangeError, rangeFor } from './energy-range';

export const MACHINE_REPORT_PAGE_SIZE = 25;

type Tab = MachineExportReport;

const TABS: readonly { value: Tab; label: string }[] = [
  { value: 'summary', label: 'Summary' },
  { value: 'cumulative', label: 'Cumulative readings' },
  { value: 'details', label: 'Detailed readings' },
];

const GROUPS: readonly { key: 'by_machine' | 'by_area' | 'by_plant'; label: string }[] = [
  { key: 'by_machine', label: 'By machine' },
  { key: 'by_area', label: 'By area' },
  { key: 'by_plant', label: 'By plant' },
];

const METRIC_LABELS: Record<string, string> = {
  PRODUCTION_COUNTER: 'Production counter',
  RUN_SECONDS: 'Run seconds',
  STOP_SECONDS: 'Stop seconds',
};

/**
 * Machine (OEE) reports: production, run / idle / stop time, availability and alarms (summary),
 * counter readings (cumulative) and raw samples (detailed, cursor paging), with CSV / Excel export.
 */
@Component({
  selector: 'app-machine-reports-page',
  imports: [
    RouterLink,
    NgTemplateOutlet,
    EnergyFiltersComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    IconComponent,
    PaginationComponent,
    SkeletonComponent,
  ],
  template: `
    <div class="energy">
      <header class="energy__header">
        <div>
          <h1 class="energy__title">Machine Reports</h1>
          <p class="energy__subtitle">
            Production, run / idle / stop time, availability, alarms and counter readings for any period
          </p>
        </div>
        <div class="energy__actions">
          <a appButton variant="ghost" routerLink="/energy"
            ><app-icon name="gauge" [size]="14" /> Energy &amp; OEE</a
          >
          <a appButton variant="ghost" routerLink="/energy/reports"
            ><app-icon name="line-chart" [size]="14" /> Energy reports</a
          >
          <button
            appButton
            variant="secondary"
            (click)="export('csv')"
            [loading]="exporting() === 'csv'"
            [disabled]="!!exporting() || !filters()"
          >
            <app-icon name="download" [size]="14" /> CSV
          </button>
          <button
            appButton
            variant="secondary"
            (click)="export('xlsx')"
            [loading]="exporting() === 'xlsx'"
            [disabled]="!!exporting() || !filters()"
          >
            <app-icon name="download" [size]="14" /> Excel
          </button>
        </div>
      </header>

      <app-card>
        <app-energy-filters initialPreset="week" assetKind="machine" (changed)="onFilters($event)" />
      </app-card>

      <div class="tabs" role="tablist" aria-label="Report">
        @for (t of tabs; track t.value) {
          <button
            type="button"
            role="tab"
            class="tab"
            [class.tab--active]="tab() === t.value"
            [attr.aria-selected]="tab() === t.value"
            (click)="setTab(t.value)"
          >
            {{ t.label }}
          </button>
        }
      </div>

      @if (error(); as err) {
        <app-card
          ><app-error-state heading="Report unavailable" [message]="err" (retry)="load()"
        /></app-card>
      } @else if (loading() && !hasData()) {
        <app-card><app-skeleton height="220px" /></app-card>
      } @else {
        @if (period(); as p) {
          <p class="energy__updated">
            {{ dateTime(p.from) }} – {{ dateTime(p.to) }} ({{ p.timezone }})
          </p>
        }
        @switch (tab()) {
          @case ('summary') {
            @if (summary(); as s) {
              <div class="kpis">
                <div class="kpi">
                  <span class="kpi__label">Production</span
                  ><span class="kpi__value">{{ quantity(s.summary.production) }}</span>
                </div>
                <div class="kpi">
                  <span class="kpi__label">Availability</span
                  ><span class="kpi__value">{{ percent(s.summary.availability) }}</span>
                </div>
                <div class="kpi">
                  <span class="kpi__label">Run time</span
                  ><span class="kpi__value">{{ duration(s.summary.run_seconds) }}</span>
                </div>
                <div class="kpi">
                  <span class="kpi__label">Idle time</span
                  ><span class="kpi__value">{{ duration(s.summary.idle_seconds) }}</span>
                </div>
                <div class="kpi">
                  <span class="kpi__label">Stop time</span
                  ><span class="kpi__value">{{ duration(s.summary.stop_seconds) }}</span>
                </div>
                <div class="kpi">
                  <span class="kpi__label">No data</span
                  ><span class="kpi__value">{{ duration(s.summary.no_data_seconds) }}</span>
                </div>
                <div class="kpi">
                  <span class="kpi__label">Alarms</span
                  ><span class="kpi__value"
                    >{{ s.summary.alarm_count ?? '—' }}
                    @if (s.summary.alarm_seconds) {
                      <small>· {{ duration(s.summary.alarm_seconds) }}</small>
                    }
                  </span>
                </div>
                <div class="kpi">
                  <span class="kpi__label">Machines</span
                  ><span class="kpi__value">{{ s.summary.machines }}</span>
                </div>
              </div>
              @if (s.metadata.notes.length) {
                <ul class="notes">
                  @for (n of s.metadata.notes; track n) {
                    <li>{{ n }}</li>
                  }
                </ul>
              }
              @for (g of groups; track g.key) {
                <section class="section">
                  <h2 class="section__title">{{ g.label }}</h2>
                  <app-card [padded]="false" expandable="true">
                    <div class="table-wrap">
                      <table class="table">
                        <thead>
                          <tr>
                            <th scope="col">Name</th>
                            <th scope="col" class="num">Production</th>
                            <th scope="col" class="num">Run</th>
                            <th scope="col" class="num">Idle</th>
                            <th scope="col" class="num">Stop</th>
                            <th scope="col" class="num">No data</th>
                            <th scope="col" class="num">Availability</th>
                            <th scope="col" class="num">Alarms</th>
                            <th scope="col" class="num">Alarm time</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (r of s[g.key]; track r.key) {
                            <tr>
                              <td>
                                <strong>{{ r.name }}</strong>
                                @if (r.code) {
                                  <div class="mono">
                                    {{ r.code }}{{ r.area_name ? ' · ' + r.area_name : '' }}
                                  </div>
                                } @else if (g.key !== 'by_machine') {
                                  <div class="mono">{{ r.machines }} machine(s)</div>
                                }
                              </td>
                              <td class="num mono">{{ quantity(r.production) }}</td>
                              <td class="num mono">{{ duration(r.run_seconds) }}</td>
                              <td class="num mono">{{ duration(r.idle_seconds) }}</td>
                              <td class="num mono">{{ duration(r.stop_seconds) }}</td>
                              <td class="num mono">{{ duration(r.no_data_seconds) }}</td>
                              <td class="num mono" [title]="availabilitySource(r)">
                                {{ percent(r.availability) }}
                              </td>
                              <td class="num mono">{{ r.alarm_count ?? '—' }}</td>
                              <td class="num mono">{{ duration(r.alarm_seconds) }}</td>
                            </tr>
                          } @empty {
                            <tr>
                              <td colspan="9" class="empty">Nothing in this selection.</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  </app-card>
                </section>
              }
            }
          }
          @case ('cumulative') {
            @if (cumulative(); as c) {
              <app-card [padded]="false" expandable="true">
                @if (c.data.rows.length) {
                  <div class="table-wrap table-sticky-container">
                    <table class="table">
                      <thead>
                        <tr>
                          <th scope="col">Machine</th>
                          <th scope="col">Location</th>
                          <th scope="col">Counter</th>
                          <th scope="col" class="num">Start reading</th>
                          <th scope="col" class="num">End reading</th>
                          <th scope="col" class="num">Increase</th>
                          <th scope="col">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (r of c.data.rows; track r.tag_id + '-' + r.machine_id) {
                          <tr>
                            <td>
                              <strong>{{ r.name }}</strong>
                              <div class="mono">{{ r.code }}</div>
                            </td>
                            <td>{{ r.plant_name }}{{ r.area_name ? ' · ' + r.area_name : '' }}</td>
                            <td>
                              {{ metricLabel(r.metric) }}
                              <div class="mono">{{ r.parameter }}</div>
                            </td>
                            <td class="num mono">{{ value(r.start_reading, r.unit) }}</td>
                            <td class="num mono">{{ value(r.end_reading, r.unit) }}</td>
                            <td class="num mono">
                              <strong>{{ value(r.increase, r.unit) }}</strong>
                            </td>
                            <td>
                              @if (r.reset_detected) {
                                <span
                                  class="badge badge--warn"
                                  title="The counter went down in this period; the increase counts from the reset"
                                  >Counter reset</span
                                >
                              }
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                  <div class="table-pagination">
                    <app-pagination
                      [page]="c.pagination.page"
                      [pageSize]="pageSize()"
                      [total]="c.pagination.total"
                      (pageChange)="go($event)"
                      (pageSizeChange)="onPageSizeChange($event)"
                    />
                  </div>
                } @else {
                  <app-empty-state
                    heading="No machine counters"
                    [message]="c.data.metadata.notes[0] || 'No readings in this period.'"
                  />
                }
              </app-card>
            }
          }
          @case ('details') {
            @if (details(); as d) {
              <app-card [padded]="false" expandable="true">
                @if (d.data.rows.length) {
                  <div class="table-wrap table-sticky-container">
                    <table class="table">
                      <thead>
                        <tr>
                          <th scope="col">Time</th>
                          <th scope="col">Machine</th>
                          <th scope="col">Location</th>
                          <th scope="col">Device</th>
                          @for (c of d.data.columns; track c.key) {
                            <th scope="col" class="num">{{ c.header }}</th>
                          }
                        </tr>
                      </thead>
                      <tbody>
                        @for (r of d.data.rows; track $index) {
                          <tr>
                            <td class="mono">{{ dateTime(r.ts) }}</td>
                            <td>{{ r.machine_name }}</td>
                            <td>{{ r.plant_name }}{{ r.area_name ? ' · ' + r.area_name : '' }}</td>
                            <td>{{ r.device_name ?? '—' }}</td>
                            @for (c of d.data.columns; track c.key) {
                              @let cell = r.cells[c.key];
                              <td
                                class="num mono"
                                [class.cell--bad]="isBad(cell)"
                                [attr.title]="isBad(cell) ? 'Quality: ' + cell.quality : null"
                              >
                                {{ cellText(cell, c) }}
                              </td>
                            }
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                  <ng-container *ngTemplateOutlet="cursorPager; context: { $implicit: d }" />
                } @else {
                  <app-empty-state
                    heading="No readings"
                    [message]="d.data.metadata.notes[0] || 'No machine samples in this period.'"
                  />
                }
              </app-card>
            }
          }
        }
      }
    </div>

    <!-- Detailed readings: cursor paging (the server does not count millions of raw samples). -->
    <ng-template #cursorPager let-p>
      <div class="table-pagination">
        <div class="cursor-pager">
          <span class="cursor-pager__info">
            Rows <strong>{{ detailFirstRow() }}</strong>–<strong>{{
              detailFirstRow() + p.data.rows.length - 1
            }}</strong>
            · page {{ detailCursors().length }}
          </span>
          <label class="cursor-pager__size">
            Rows per page
            <select [value]="pageSize()" (change)="onPageSizeChange(+$any($event.target).value)">
              @for (opt of pageSizes; track opt) {
                <option [value]="opt" [selected]="opt === pageSize()">{{ opt }}</option>
              }
            </select>
          </label>
          <button
            appButton
            variant="ghost"
            size="sm"
            type="button"
            [disabled]="detailCursors().length <= 1"
            aria-label="Previous page"
            (click)="previousDetails()"
          >
            <app-icon name="chevron-left" [size]="14" /> Previous
          </button>
          <button
            appButton
            variant="ghost"
            size="sm"
            type="button"
            [disabled]="!p.pagination.has_more"
            aria-label="Next page"
            (click)="nextDetails(p.pagination.next_cursor)"
          >
            Next <app-icon name="chevron-right" [size]="14" />
          </button>
        </div>
      </div>
    </ng-template>
  `,
  styleUrls: ['./energy.scss', './energy-reports.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MachineReportsPageComponent {
  private readonly api = inject(MachineReportsApi);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tabs = TABS;
  protected readonly groups = GROUPS;
  protected readonly pageSizes = [25, 50, 100];
  protected readonly tab = signal<Tab>('summary');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(MACHINE_REPORT_PAGE_SIZE);
  protected readonly filters = signal<EnergyFilterState | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly exporting = signal<EnergyExportFormat | null>(null);

  protected readonly summary = signal<MachineReportSummary | null>(null);
  protected readonly cumulative = signal<MachineCumulativePage | null>(null);
  protected readonly details = signal<MachineWideDetailsPage | null>(null);
  /** Cursors of the detail pages visited so far: the last one is the current page ('' = first). */
  protected readonly detailCursors = signal<string[]>(['']);
  protected readonly detailFirstRow = computed(
    () => (this.detailCursors().length - 1) * this.pageSize() + 1,
  );

  protected readonly hasData = computed(() => {
    switch (this.tab()) {
      case 'summary':
        return !!this.summary();
      case 'cumulative':
        return !!this.cumulative();
      case 'details':
        return !!this.details();
    }
  });
  protected readonly period = computed<Metadata | null>(() => {
    switch (this.tab()) {
      case 'summary':
        return this.summary()?.metadata ?? null;
      case 'cumulative':
        return this.cumulative()?.data.metadata ?? null;
      case 'details':
        return this.details()?.data.metadata ?? null;
    }
  });

  private readonly load$ = new Subject<void>();

  constructor() {
    this.load$
      .pipe(
        switchMap(() => this.request()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected onFilters(state: EnergyFilterState): void {
    this.filters.set(state);
    this.reset();
    this.summary.set(null);
    this.cumulative.set(null);
    this.details.set(null);
    this.load();
  }

  protected setTab(tab: Tab): void {
    this.tab.set(tab);
    this.reset();
    this.load();
  }

  protected go(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.reset();
    this.load();
  }

  protected nextDetails(cursor: string | null): void {
    if (cursor) {
      this.detailCursors.update((c) => [...c, cursor]);
      this.load();
    }
  }

  protected previousDetails(): void {
    if (this.detailCursors().length > 1) {
      this.detailCursors.update((c) => c.slice(0, -1));
      this.load();
    }
  }

  protected load(): void {
    this.load$.next();
  }

  private reset(): void {
    this.page.set(1);
    this.detailCursors.set(['']);
  }

  private query() {
    const state = this.filters()!;
    return { ...state.scope, ...rangeFor(state.preset, new Date(), state.custom, false) };
  }

  private request(): Observable<unknown> {
    const state = this.filters();
    if (!state || (state.preset === 'custom' && customRangeError(state.custom))) {
      return of(null);
    }
    this.loading.set(true);
    this.error.set(null);
    const query = this.query();
    const call: Observable<unknown> =
      this.tab() === 'summary'
        ? this.api.summary(query).pipe(tap((s) => this.summary.set(s)))
        : this.tab() === 'cumulative'
          ? this.api
              .cumulative({ ...query, page: this.page(), page_size: this.pageSize() })
              .pipe(tap((c) => this.cumulative.set(c)))
          : this.api
              .details({
                ...query,
                page_size: this.pageSize(),
                cursor: this.detailCursors().at(-1) ?? '',
              })
              .pipe(tap((d) => this.details.set(d)));
    return call.pipe(
      catchError((e) => {
        this.error.set(ApiError.from(e).message);
        return of(null);
      }),
      finalize(() => this.loading.set(false)),
    );
  }

  protected export(format: EnergyExportFormat): void {
    if (!this.filters()) {
      return;
    }
    this.exporting.set(format);
    this.api
      .export({ ...this.query(), report: this.tab(), format })
      .pipe(
        map((file) =>
          saveBlob(this.document, file.blob, file.filename ?? `machine-${this.tab()}.${format}`),
        ),
        finalize(() => this.exporting.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.toast.success('Export downloaded'),
        error: (e) => this.toast.error(e),
      });
  }

  protected percent(value: number | null): string {
    return value == null ? '—' : `${(value * 100).toFixed(1)} %`;
  }

  protected duration(seconds: number | null): string {
    return seconds == null ? '—' : formatDuration(seconds);
  }

  protected availabilitySource(r: MachineSummaryRow): string {
    switch (r.availability_source) {
      case 'counters':
        return "From the PLC's run / stop second counters";
      case 'run_status':
        return 'From the machine status (run / idle / stop)';
      case 'mixed':
        return 'Counters for some machines, machine status for others';
      default:
        return '';
    }
  }

  protected metricLabel(metric: string): string {
    return METRIC_LABELS[metric] ?? metric;
  }

  /** A reading in the horizontal table: the state text of run-status cells, else the number. */
  protected cellText(cell: WideCell | undefined, column: WideColumn): string {
    if (!cell) return '';
    if (cell.text) return cell.text;
    return cell.value == null ? '—' : formatValue(cell.value, null, column.roundoff_digits);
  }

  protected isBad(cell: WideCell | undefined): boolean {
    return !!cell?.quality && cell.quality.toUpperCase() !== 'GOOD';
  }

  protected quantity = formatQuantity;
  protected value = formatValue;

  protected dateTime(ts: string): string {
    return formatDateTime(ts);
  }
}
