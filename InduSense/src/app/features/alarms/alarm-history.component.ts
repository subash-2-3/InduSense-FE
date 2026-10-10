import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { ApiError } from '../../core/api/api-error';
import { AlarmsApi } from '../../core/api/resources/alarms.api';
import { AlarmHistoryFilters, AlarmHistoryPage } from '../../core/models';
import {
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  IconComponent,
  PaginationComponent,
  SearchableSelectComponent,
  SelectOption,
  SkeletonComponent,
  ToastService,
} from '../../shared/ui';
import { saveBlob } from '../../shared/utils/download';
import { formatDateTime, formatDuration } from '../../shared/utils/format';
import { SortDirection, sortData, toggleSort } from '../../shared/utils/sort';
import {
  RANGE_OPTIONS,
  RangePreset,
  customRangeError,
  rangeFor,
  toLocalInput,
} from '../energy/energy-range';

export const HISTORY_PAGE_SIZE = 25;

/** When each alarm bit was set and cleared, newest first, with CSV / Excel export. */
@Component({
  selector: 'app-alarm-history',
  imports: [
    FormsModule,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    IconComponent,
    SearchableSelectComponent,
    SkeletonComponent,
    PaginationComponent,
  ],
  template: `
    <div class="toolbar">
      <div class="toolbar__group">
        <label class="fl">
          <span>Period</span>
          <app-searchable-select
            ariaLabel="Period"
            [options]="ranges"
            [ngModel]="preset()"
            (ngModelChange)="setPreset($event)"
          />
        </label>
        @if (preset() === 'custom') {
          <label class="fl">
            <span>From</span>
            <input
              class="control"
              type="datetime-local"
              [ngModel]="customFrom()"
              (ngModelChange)="customFrom.set($event)"
            />
          </label>
          <label class="fl">
            <span>To</span>
            <input
              class="control"
              type="datetime-local"
              [ngModel]="customTo()"
              (ngModelChange)="customTo.set($event)"
            />
          </label>
          <button
            appButton
            variant="secondary"
            type="button"
            [disabled]="!!customError()"
            (click)="go(1)"
          >
            Apply
          </button>
        }
        <label class="fl">
          <span>Bit</span>
          <app-searchable-select
            ariaLabel="Bit"
            placeholder="All bits"
            clearable
            [options]="bitOptions"
            [ngModel]="bit()"
            (ngModelChange)="setBit($event)"
          />
        </label>
      </div>
      <div class="toolbar__group">
        <button
          appButton
          variant="secondary"
          type="button"
          [loading]="exporting() === 'csv'"
          [disabled]="!!exporting()"
          (click)="export('csv')"
        >
          <app-icon name="download" [size]="14" /> CSV
        </button>
        <button
          appButton
          variant="secondary"
          type="button"
          [loading]="exporting() === 'xlsx'"
          [disabled]="!!exporting()"
          (click)="export('xlsx')"
        >
          <app-icon name="download" [size]="14" /> Excel
        </button>
      </div>
    </div>
    @if (preset() === 'custom' && customError(); as e) {
      <p class="muted" role="alert">{{ e }}</p>
    }

    <app-card heading="Alarm History Log" [padded]="false" expandable="true">
      @if (error(); as e) {
        <div class="pad">
          <app-error-state heading="Alarm history unavailable" [message]="e" (retry)="go(page())" />
        </div>
      } @else if (loading() && !data()) {
        <div class="pad"><app-skeleton height="200px" /></div>
      } @else if (data(); as d) {
        @if (d.data.rows.length) {
          <div class="wrap table-sticky-container">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col" class="th-sortable" (click)="toggleSort('name')" tabindex="0" (keydown.enter)="toggleSort('name')">
                    <span class="th-sort-content">
                      Alarm
                      <app-icon
                        [name]="sortKey() === 'name' ? (sortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                        [size]="13"
                        [class.sort-icon-active]="sortKey() === 'name'"
                        [class.sort-icon-muted]="sortKey() !== 'name'"
                      />
                    </span>
                  </th>
                  <th scope="col" class="th-sortable" (click)="toggleSort('machine_name')" tabindex="0" (keydown.enter)="toggleSort('machine_name')">
                    <span class="th-sort-content">
                      Machine
                      <app-icon
                        [name]="sortKey() === 'machine_name' ? (sortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                        [size]="13"
                        [class.sort-icon-active]="sortKey() === 'machine_name'"
                        [class.sort-icon-muted]="sortKey() !== 'machine_name'"
                      />
                    </span>
                  </th>
                  <th scope="col" class="num th-sortable" (click)="toggleSort('bit')" tabindex="0" (keydown.enter)="toggleSort('bit')">
                    <span class="th-sort-content">
                      Bit
                      <app-icon
                        [name]="sortKey() === 'bit' ? (sortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                        [size]="13"
                        [class.sort-icon-active]="sortKey() === 'bit'"
                        [class.sort-icon-muted]="sortKey() !== 'bit'"
                      />
                    </span>
                  </th>
                  <th scope="col" class="th-sortable" (click)="toggleSort('start')" tabindex="0" (keydown.enter)="toggleSort('start')">
                    <span class="th-sort-content">
                      Start
                      <app-icon
                        [name]="sortKey() === 'start' ? (sortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                        [size]="13"
                        [class.sort-icon-active]="sortKey() === 'start'"
                        [class.sort-icon-muted]="sortKey() !== 'start'"
                      />
                    </span>
                  </th>
                  <th scope="col" class="th-sortable" (click)="toggleSort('end')" tabindex="0" (keydown.enter)="toggleSort('end')">
                    <span class="th-sort-content">
                      End
                      <app-icon
                        [name]="sortKey() === 'end' ? (sortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                        [size]="13"
                        [class.sort-icon-active]="sortKey() === 'end'"
                        [class.sort-icon-muted]="sortKey() !== 'end'"
                      />
                    </span>
                  </th>
                  <th scope="col" class="num th-sortable" (click)="toggleSort('duration_seconds')" tabindex="0" (keydown.enter)="toggleSort('duration_seconds')">
                    <span class="th-sort-content">
                      Duration
                      <app-icon
                        [name]="sortKey() === 'duration_seconds' ? (sortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                        [size]="13"
                        [class.sort-icon-active]="sortKey() === 'duration_seconds'"
                        [class.sort-icon-muted]="sortKey() !== 'duration_seconds'"
                      />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (r of sortedRows(); track $index) {
                  <tr>
                    <td>
                      <span class="alarm-name alarm-name--unnamed">{{ r.name }}</span>
                      @if (r.message) {
                        <div class="sub">{{ r.message }}</div>
                      }
                    </td>
                    <td>
                      {{ r.machine_name }}
                      <div class="sub">{{ r.plant_name }}</div>
                    </td>
                    <td class="num mono">{{ r.bit }}</td>
                    <td>
                      {{ dateTime(r.start) }}
                      @if (r.started_before_range) {
                        <div class="sub">already active at the period start</div>
                      }
                    </td>
                    <td>
                      @if (r.ongoing) {
                        <span class="pill pill--on">still active</span>
                      } @else {
                        {{ dateTime(r.end) }}
                      }
                    </td>
                    <td class="num mono">{{ duration(r.duration_seconds) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="table-pagination">
            <app-pagination
              [page]="d.pagination.page"
              [pageSize]="pageSize()"
              [total]="d.pagination.total"
              (pageChange)="go($event)"
              (pageSizeChange)="onPageSizeChange($event)"
            />
          </div>
        } @else {
          <div class="pad">
            <app-empty-state
              heading="No alarms"
              [message]="d.data.metadata.notes[0] || 'No alarm was active in this period.'"
            />
          </div>
        }
      }
    </app-card>
  `,
  styleUrl: './alarms.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlarmHistoryComponent {
  readonly machineId = input<number | null>(null);

  private readonly api = inject(AlarmsApi);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);

  protected readonly ranges = RANGE_OPTIONS;
  protected readonly bits = Array.from({ length: 32 }, (_, i) => i);
  protected readonly bitOptions: SelectOption[] = this.bits.map((b) => ({
    value: b,
    label: `Bit ${b}`,
  }));
  protected readonly preset = signal<RangePreset>('week');
  protected readonly customFrom = signal(toLocalInput(new Date(Date.now() - 24 * 3600 * 1000)));
  protected readonly customTo = signal(toLocalInput(new Date()));
  protected readonly bit = signal<number | null>(null);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(HISTORY_PAGE_SIZE);
  protected readonly sortKey = signal<string | null>(null);
  protected readonly sortDir = signal<SortDirection>('asc');
  protected readonly data = signal<AlarmHistoryPage | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly exporting = signal<'csv' | 'xlsx' | null>(null);

  protected readonly sortedRows = computed(() => {
    const rows = this.data()?.data?.rows || [];
    const k = this.sortKey();
    if (!k) return rows;
    return sortData(rows, (r: any) => r[k], this.sortDir());
  });

  constructor() {
    effect(() => {
      this.machineId();
      this.go(1);
    });
  }

  protected toggleSort(key: string): void {
    toggleSort(this.sortKey, this.sortDir, key);
  }

  protected onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.go(1);
  }

  protected customError(): string | null {
    return customRangeError({ from: this.customFrom(), to: this.customTo() });
  }

  private filters(): AlarmHistoryFilters {
    const range = rangeFor(
      this.preset(),
      new Date(),
      { from: this.customFrom(), to: this.customTo() },
      false,
    );
    return {
      ...range,
      machine_id: this.machineId() ?? undefined,
      bit: this.bit() ?? undefined,
    };
  }

  protected setPreset(preset: RangePreset): void {
    this.preset.set(preset);
    if (preset !== 'custom') this.go(1);
  }

  protected setBit(bit: number | null): void {
    this.bit.set(bit);
    this.go(1);
  }

  go(page: number): void {
    if (this.preset() === 'custom' && this.customError()) {
      return;
    }
    this.page.set(page);
    this.loading.set(true);
    this.error.set(null);
    this.api
      .history({ ...this.filters(), page, page_size: this.pageSize() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (d) => this.data.set(d),
        error: (e) => this.error.set(ApiError.from(e).message),
      });
  }

  protected export(format: 'csv' | 'xlsx'): void {
    this.exporting.set(format);
    this.api
      .exportHistory(this.filters(), format)
      .pipe(finalize(() => this.exporting.set(null)))
      .subscribe({
        next: (file) => {
          saveBlob(this.document, file.blob, file.filename ?? `alarm-history.${format}`);
          this.toast.success('Export downloaded');
        },
        error: (e) => this.toast.error(e),
      });
  }

  protected dateTime(ts: string | null): string {
    return formatDateTime(ts);
  }

  protected duration(seconds: number): string {
    return formatDuration(seconds);
  }
}
