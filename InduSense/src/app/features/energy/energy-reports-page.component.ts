import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
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
import { Observable, Subject, catchError, finalize, map, of, switchMap, tap } from 'rxjs';

import { ApiError } from '../../core/api/api-error';
import { EnergyApi } from '../../core/api/resources/energy.api';
import {
  CumulativeRow,
  DetailRow,
  EnergyExportFormat,
  EnergyExportReport,
  EnergyPage,
  EnergyReportSummary,
  GroupSummaryRow,
  Metadata,
} from '../../core/models';
import {
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  IconComponent,
  SkeletonComponent,
  ToastService,
} from '../../shared/ui';
import { formatDateTime } from '../../shared/utils/format';
import { formatKpi, formatQuantity, formatValue } from './energy-charts';
import { EnergyFilterState, EnergyFiltersComponent } from './energy-filters.component';
import { customRangeError, rangeFor } from './energy-range';

export const REPORT_PAGE_SIZE = 25;

type Tab = EnergyExportReport;

const TABS: readonly { value: Tab; label: string }[] = [
  { value: 'summary', label: 'Summary' },
  { value: 'cumulative', label: 'Cumulative readings' },
  { value: 'details', label: 'Detailed readings' },
];

const GROUPS: readonly { key: keyof EnergyReportSummary; label: string }[] = [
  { key: 'by_plant', label: 'By plant' },
  { key: 'by_area', label: 'By area' },
  { key: 'by_machine', label: 'By machine' },
  { key: 'by_meter', label: 'By meter' },
];

/** Saves a downloaded file in the browser. */
export function saveBlob(document: Document, blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

@Component({
  selector: 'app-energy-reports-page',
  imports: [
    RouterLink,
    NgTemplateOutlet,
    EnergyFiltersComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    IconComponent,
    SkeletonComponent,
  ],
  template: `
    <div class="energy">
      <header class="energy__header">
        <div>
          <h1 class="energy__title">Energy Reports</h1>
          <p class="energy__subtitle">
            Consumption, cumulative register readings and raw samples for any period
          </p>
        </div>
        <div class="energy__actions">
          <a appButton variant="ghost" routerLink="/energy"
            ><app-icon name="gauge" [size]="14" /> Energy dashboard</a
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
        <app-energy-filters initialPreset="week" (changed)="onFilters($event)" />
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
                  <span class="kpi__label">Total energy</span
                  ><span class="kpi__value">{{ quantity(s.summary.total_energy) }}</span>
                </div>
                <div class="kpi">
                  <span class="kpi__label">Average power</span
                  ><span class="kpi__value">{{ kpi(s.summary.average_power) }}</span>
                </div>
                <div class="kpi">
                  <span class="kpi__label">Peak power</span
                  ><span class="kpi__value">{{ kpi(s.summary.peak_power) }}</span>
                </div>
                <div class="kpi">
                  <span class="kpi__label">Minimum power</span
                  ><span class="kpi__value">{{ kpi(s.summary.minimum_power) }}</span>
                </div>
                <div class="kpi">
                  <span class="kpi__label">Avg power factor</span
                  ><span class="kpi__value">{{ kpi(s.summary.average_power_factor) }}</span>
                </div>
                <div class="kpi">
                  <span class="kpi__label">Avg voltage</span
                  ><span class="kpi__value">{{ kpi(s.summary.average_voltage) }}</span>
                </div>
                <div class="kpi">
                  <span class="kpi__label">Avg current</span
                  ><span class="kpi__value">{{ kpi(s.summary.average_current) }}</span>
                </div>
                <div class="kpi">
                  <span class="kpi__label">Meters / machines</span
                  ><span class="kpi__value">{{ s.summary.meters }} / {{ s.summary.machines }}</span>
                </div>
              </div>
              @if (s.metadata.notes.length) {
                <ul class="notes">
                  @for (n of s.metadata.notes; track n) {
                    <li>{{ n }}</li>
                  }
                </ul>
              }
              <div class="split">
                @for (g of groups; track g.key) {
                  <section class="section">
                    <h2 class="section__title">{{ g.label }}</h2>
                    <app-card [padded]="false">
                      <div class="table-wrap">
                        <table class="table">
                          <thead>
                            <tr>
                              <th scope="col">Name</th>
                              <th scope="col" class="num">Energy</th>
                              <th scope="col" class="num">Avg power</th>
                              <th scope="col" class="num">Peak power</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (r of groupRows(s, g.key); track r.key) {
                              <tr>
                                <td>{{ r.name }}</td>
                                <td class="num mono">{{ quantity(r.energy) }}</td>
                                <td class="num mono">{{ kpi(r.average_power) }}</td>
                                <td class="num mono">{{ kpi(r.peak_power) }}</td>
                              </tr>
                            } @empty {
                              <tr>
                                <td colspan="4" class="empty">Nothing in this selection.</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    </app-card>
                  </section>
                }
              </div>
            }
          }
          @case ('cumulative') {
            @if (cumulative(); as c) {
              <app-card [padded]="false">
                @if (c.data.rows.length) {
                  <div class="table-wrap">
                    <table class="table">
                      <thead>
                        <tr>
                          <th scope="col">Asset</th>
                          <th scope="col">Location</th>
                          <th scope="col" class="num">Start reading</th>
                          <th scope="col" class="num">End reading</th>
                          <th scope="col" class="num">Consumed</th>
                          <th scope="col" class="num">Avg power</th>
                          <th scope="col" class="num">Peak power</th>
                          <th scope="col">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (r of c.data.rows; track r.tag_id + '-' + r.asset_id) {
                          <tr>
                            <td>
                              <strong>{{ r.name }}</strong>
                              <div class="mono">{{ r.asset_type }} · {{ r.code }}</div>
                            </td>
                            <td>{{ r.plant_name }}{{ r.area_name ? ' · ' + r.area_name : '' }}</td>
                            <td class="num mono">{{ value(r.start_reading, r.unit) }}</td>
                            <td class="num mono">{{ value(r.end_reading, r.unit) }}</td>
                            <td class="num mono">
                              <strong>{{ value(r.consumed, r.unit) }}</strong>
                            </td>
                            <td class="num mono">{{ kpi(r.average_power) }}</td>
                            <td class="num mono">{{ kpi(r.peak_power) }}</td>
                            <td>
                              @if (r.reset_detected) {
                                <span
                                  class="badge badge--warn"
                                  title="The register went down in this period; consumption counts from the reset"
                                  >Meter reset</span
                                >
                              }
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                  <ng-container *ngTemplateOutlet="pager; context: { $implicit: c }" />
                } @else {
                  <app-empty-state
                    heading="No energy registers"
                    [message]="c.data.metadata.notes[0] || 'No readings in this period.'"
                  />
                }
              </app-card>
            }
          }
          @case ('details') {
            @if (details(); as d) {
              <app-card [padded]="false">
                @if (d.data.rows.length) {
                  <div class="table-wrap">
                    <table class="table">
                      <thead>
                        <tr>
                          <th scope="col">Time</th>
                          <th scope="col">Asset</th>
                          <th scope="col">Location</th>
                          <th scope="col">Device</th>
                          <th scope="col">Parameter</th>
                          <th scope="col" class="num">Value</th>
                          <th scope="col">Quality</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (r of d.data.rows; track $index) {
                          <tr>
                            <td class="mono">{{ dateTime(r.ts) }}</td>
                            <td>{{ r.asset_name }}</td>
                            <td>{{ r.plant_name }}{{ r.area_name ? ' · ' + r.area_name : '' }}</td>
                            <td>{{ r.device_name ?? '—' }}</td>
                            <td>{{ r.parameter }}</td>
                            <td class="num mono">{{ value(r.value, r.unit) }}</td>
                            <td>{{ r.quality ?? '—' }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                  <ng-container *ngTemplateOutlet="pager; context: { $implicit: d }" />
                } @else {
                  <app-empty-state
                    heading="No readings"
                    message="No samples of energy parameters in this period."
                  />
                }
              </app-card>
            }
          }
        }
      }
    </div>

    <ng-template #pager let-p>
      <div class="pager">
        <span
          >Page {{ p.pagination.page }} of {{ p.pagination.total_pages || 1 }} ·
          {{ p.pagination.total }} rows</span
        >
        <div class="pager__buttons">
          <button
            appButton
            variant="secondary"
            size="sm"
            [disabled]="p.pagination.page <= 1 || loading()"
            (click)="go(p.pagination.page - 1)"
          >
            <app-icon name="chevron-left" [size]="14" /> Previous
          </button>
          <button
            appButton
            variant="secondary"
            size="sm"
            [disabled]="p.pagination.page >= p.pagination.total_pages || loading()"
            (click)="go(p.pagination.page + 1)"
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
export class EnergyReportsPageComponent {
  private readonly api = inject(EnergyApi);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tabs = TABS;
  protected readonly groups = GROUPS;
  protected readonly tab = signal<Tab>('summary');
  protected readonly page = signal(1);
  protected readonly filters = signal<EnergyFilterState | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly exporting = signal<EnergyExportFormat | null>(null);

  protected readonly summary = signal<EnergyReportSummary | null>(null);
  protected readonly cumulative = signal<EnergyPage<CumulativeRow> | null>(null);
  protected readonly details = signal<EnergyPage<DetailRow> | null>(null);

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
    this.page.set(1);
    this.summary.set(null);
    this.cumulative.set(null);
    this.details.set(null);
    this.load();
  }

  protected setTab(tab: Tab): void {
    this.tab.set(tab);
    this.page.set(1);
    this.load();
  }

  protected go(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected load(): void {
    this.load$.next();
  }

  private query() {
    const state = this.filters()!;
    return { ...state.scope, ...rangeFor(state.preset, new Date(), state.custom, false) };
  }

  private request(): Observable<unknown> {
    const state = this.filters();
    if (!state) {
      return of(null);
    }
    if (state.preset === 'custom' && customRangeError(state.custom)) {
      return of(null);
    }
    this.loading.set(true);
    this.error.set(null);
    const query = this.query();
    const paged = { ...query, page: this.page(), page_size: REPORT_PAGE_SIZE };
    const call: Observable<unknown> =
      this.tab() === 'summary'
        ? this.api.reportSummary(query).pipe(tap((s) => this.summary.set(s)))
        : this.tab() === 'cumulative'
          ? this.api.reportCumulative(paged).pipe(tap((c) => this.cumulative.set(c)))
          : this.api.reportDetails(paged).pipe(tap((d) => this.details.set(d)));
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
          saveBlob(this.document, file.blob, file.filename ?? `energy-${this.tab()}.${format}`),
        ),
        finalize(() => this.exporting.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.toast.success('Export downloaded'),
        error: (e) => this.toast.error(e),
      });
  }

  protected groupRows(s: EnergyReportSummary, key: keyof EnergyReportSummary): GroupSummaryRow[] {
    return s[key] as GroupSummaryRow[];
  }

  protected kpi = formatKpi;
  protected quantity = formatQuantity;
  protected value = formatValue;

  protected dateTime(ts: string): string {
    return formatDateTime(ts);
  }
}
