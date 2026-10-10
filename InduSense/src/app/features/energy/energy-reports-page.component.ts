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
  PaginationComponent,
  SkeletonComponent,
  ToastService,
} from '../../shared/ui';
import { saveBlob } from '../../shared/utils/download';
import { formatDateTime } from '../../shared/utils/format';
import { SortDirection, sortData, toggleSort } from '../../shared/utils/sort';
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
    PaginationComponent,
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
                    <app-card [padded]="false" expandable="true">
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
              <app-card [padded]="false" expandable="true">
                @if (c.data.rows.length) {
                  <div class="table-wrap table-sticky-container">
                    <table class="table">
                      <thead>
                        <tr>
                          <th scope="col" class="th-sortable" (click)="toggleCumulativeSort('name')" tabindex="0" (keydown.enter)="toggleCumulativeSort('name')">
                            <span class="th-sort-content">
                              Asset
                              <app-icon
                                [name]="cumulativeSortKey() === 'name' ? (cumulativeSortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                                [size]="13"
                                [class.sort-icon-active]="cumulativeSortKey() === 'name'"
                                [class.sort-icon-muted]="cumulativeSortKey() !== 'name'"
                              />
                            </span>
                          </th>
                          <th scope="col" class="th-sortable" (click)="toggleCumulativeSort('plant_name')" tabindex="0" (keydown.enter)="toggleCumulativeSort('plant_name')">
                            <span class="th-sort-content">
                              Location
                              <app-icon
                                [name]="cumulativeSortKey() === 'plant_name' ? (cumulativeSortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                                [size]="13"
                                [class.sort-icon-active]="cumulativeSortKey() === 'plant_name'"
                                [class.sort-icon-muted]="cumulativeSortKey() !== 'plant_name'"
                              />
                            </span>
                          </th>
                          <th scope="col" class="num th-sortable" (click)="toggleCumulativeSort('start_reading')" tabindex="0" (keydown.enter)="toggleCumulativeSort('start_reading')">
                            <span class="th-sort-content">
                              Start reading
                              <app-icon
                                [name]="cumulativeSortKey() === 'start_reading' ? (cumulativeSortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                                [size]="13"
                                [class.sort-icon-active]="cumulativeSortKey() === 'start_reading'"
                                [class.sort-icon-muted]="cumulativeSortKey() !== 'start_reading'"
                              />
                            </span>
                          </th>
                          <th scope="col" class="num th-sortable" (click)="toggleCumulativeSort('end_reading')" tabindex="0" (keydown.enter)="toggleCumulativeSort('end_reading')">
                            <span class="th-sort-content">
                              End reading
                              <app-icon
                                [name]="cumulativeSortKey() === 'end_reading' ? (cumulativeSortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                                [size]="13"
                                [class.sort-icon-active]="cumulativeSortKey() === 'end_reading'"
                                [class.sort-icon-muted]="cumulativeSortKey() !== 'end_reading'"
                              />
                            </span>
                          </th>
                          <th scope="col" class="num th-sortable" (click)="toggleCumulativeSort('consumed')" tabindex="0" (keydown.enter)="toggleCumulativeSort('consumed')">
                            <span class="th-sort-content">
                              Consumed
                              <app-icon
                                [name]="cumulativeSortKey() === 'consumed' ? (cumulativeSortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                                [size]="13"
                                [class.sort-icon-active]="cumulativeSortKey() === 'consumed'"
                                [class.sort-icon-muted]="cumulativeSortKey() !== 'consumed'"
                              />
                            </span>
                          </th>
                          <th scope="col" class="num th-sortable" (click)="toggleCumulativeSort('average_power')" tabindex="0" (keydown.enter)="toggleCumulativeSort('average_power')">
                            <span class="th-sort-content">
                              Avg power
                              <app-icon
                                [name]="cumulativeSortKey() === 'average_power' ? (cumulativeSortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                                [size]="13"
                                [class.sort-icon-active]="cumulativeSortKey() === 'average_power'"
                                [class.sort-icon-muted]="cumulativeSortKey() !== 'average_power'"
                              />
                            </span>
                          </th>
                          <th scope="col" class="num th-sortable" (click)="toggleCumulativeSort('peak_power')" tabindex="0" (keydown.enter)="toggleCumulativeSort('peak_power')">
                            <span class="th-sort-content">
                              Peak power
                              <app-icon
                                [name]="cumulativeSortKey() === 'peak_power' ? (cumulativeSortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                                [size]="13"
                                [class.sort-icon-active]="cumulativeSortKey() === 'peak_power'"
                                [class.sort-icon-muted]="cumulativeSortKey() !== 'peak_power'"
                              />
                            </span>
                          </th>
                          <th scope="col">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (r of sortedCumulativeRows(); track r.tag_id + '-' + r.asset_id) {
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
              <app-card [padded]="false" expandable="true">
                @if (d.data.rows.length) {
                  <div class="table-wrap table-sticky-container">
                    <table class="table">
                      <thead>
                        <tr>
                          <th scope="col" class="th-sortable" (click)="toggleDetailsSort('ts')" tabindex="0" (keydown.enter)="toggleDetailsSort('ts')">
                            <span class="th-sort-content">
                              Time
                              <app-icon
                                [name]="detailsSortKey() === 'ts' ? (detailsSortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                                [size]="13"
                                [class.sort-icon-active]="detailsSortKey() === 'ts'"
                                [class.sort-icon-muted]="detailsSortKey() !== 'ts'"
                              />
                            </span>
                          </th>
                          <th scope="col" class="th-sortable" (click)="toggleDetailsSort('asset_name')" tabindex="0" (keydown.enter)="toggleDetailsSort('asset_name')">
                            <span class="th-sort-content">
                              Asset
                              <app-icon
                                [name]="detailsSortKey() === 'asset_name' ? (detailsSortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                                [size]="13"
                                [class.sort-icon-active]="detailsSortKey() === 'asset_name'"
                                [class.sort-icon-muted]="detailsSortKey() !== 'asset_name'"
                              />
                            </span>
                          </th>
                          <th scope="col" class="th-sortable" (click)="toggleDetailsSort('plant_name')" tabindex="0" (keydown.enter)="toggleDetailsSort('plant_name')">
                            <span class="th-sort-content">
                              Location
                              <app-icon
                                [name]="detailsSortKey() === 'plant_name' ? (detailsSortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                                [size]="13"
                                [class.sort-icon-active]="detailsSortKey() === 'plant_name'"
                                [class.sort-icon-muted]="detailsSortKey() !== 'plant_name'"
                              />
                            </span>
                          </th>
                          <th scope="col" class="th-sortable" (click)="toggleDetailsSort('device_name')" tabindex="0" (keydown.enter)="toggleDetailsSort('device_name')">
                            <span class="th-sort-content">
                              Device
                              <app-icon
                                [name]="detailsSortKey() === 'device_name' ? (detailsSortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                                [size]="13"
                                [class.sort-icon-active]="detailsSortKey() === 'device_name'"
                                [class.sort-icon-muted]="detailsSortKey() !== 'device_name'"
                              />
                            </span>
                          </th>
                          <th scope="col" class="th-sortable" (click)="toggleDetailsSort('parameter')" tabindex="0" (keydown.enter)="toggleDetailsSort('parameter')">
                            <span class="th-sort-content">
                              Parameter
                              <app-icon
                                [name]="detailsSortKey() === 'parameter' ? (detailsSortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                                [size]="13"
                                [class.sort-icon-active]="detailsSortKey() === 'parameter'"
                                [class.sort-icon-muted]="detailsSortKey() !== 'parameter'"
                              />
                            </span>
                          </th>
                          <th scope="col" class="num th-sortable" (click)="toggleDetailsSort('value')" tabindex="0" (keydown.enter)="toggleDetailsSort('value')">
                            <span class="th-sort-content">
                              Value
                              <app-icon
                                [name]="detailsSortKey() === 'value' ? (detailsSortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                                [size]="13"
                                [class.sort-icon-active]="detailsSortKey() === 'value'"
                                [class.sort-icon-muted]="detailsSortKey() !== 'value'"
                              />
                            </span>
                          </th>
                          <th scope="col">Quality</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (r of sortedDetailRows(); track $index) {
                          <tr>
                            <td class="mono">{{ dateTime(r.ts) }}</td>
                            <td>{{ r.asset_name }}</td>
                            <td>{{ r.plant_name }}{{ r.area_name ? ' · ' + r.area_name : '' }}</td>
                            <td>{{ r.device_name ?? '—' }}</td>
                            <td>{{ r.parameter }}</td>
                            <td class="num mono">
                              {{ value(r.value, r.unit, r.roundoff_digits) }}
                            </td>
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
      <div class="table-pagination">
        <app-pagination
          [page]="p.pagination.page"
          [pageSize]="pageSize()"
          [total]="p.pagination.total"
          (pageChange)="go($event)"
          (pageSizeChange)="onPageSizeChange($event)"
        />
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
  protected readonly pageSize = signal(REPORT_PAGE_SIZE);
  protected readonly filters = signal<EnergyFilterState | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly exporting = signal<EnergyExportFormat | null>(null);

  protected readonly summary = signal<EnergyReportSummary | null>(null);
  protected readonly cumulative = signal<EnergyPage<CumulativeRow> | null>(null);
  protected readonly details = signal<EnergyPage<DetailRow> | null>(null);

  protected readonly cumulativeSortKey = signal<string | null>(null);
  protected readonly cumulativeSortDir = signal<SortDirection>('asc');

  protected readonly sortedCumulativeRows = computed(() => {
    const rows = this.cumulative()?.data.rows || [];
    const k = this.cumulativeSortKey();
    if (!k) return rows;
    return sortData(rows, (r: any) => r[k], this.cumulativeSortDir());
  });

  protected readonly detailsSortKey = signal<string | null>(null);
  protected readonly detailsSortDir = signal<SortDirection>('asc');

  protected readonly sortedDetailRows = computed(() => {
    const rows = this.details()?.data.rows || [];
    const k = this.detailsSortKey();
    if (!k) return rows;
    return sortData(rows, (r: any) => r[k], this.detailsSortDir());
  });

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

  protected toggleCumulativeSort(key: string): void {
    toggleSort(this.cumulativeSortKey, this.cumulativeSortDir, key);
  }

  protected toggleDetailsSort(key: string): void {
    toggleSort(this.detailsSortKey, this.detailsSortDir, key);
  }

  protected onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.go(1);
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
    const paged = { ...query, page: this.page(), page_size: this.pageSize() };
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
