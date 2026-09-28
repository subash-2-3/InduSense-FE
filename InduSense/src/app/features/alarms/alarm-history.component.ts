import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
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
  SkeletonComponent,
  ToastService,
} from '../../shared/ui';
import { saveBlob } from '../../shared/utils/download';
import { formatDateTime, formatDuration } from '../../shared/utils/format';
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
    SkeletonComponent,
  ],
  template: `
    <div class="toolbar">
      <div class="toolbar__group">
        <label class="fl">
          <span>Period</span>
          <select class="control" [ngModel]="preset()" (ngModelChange)="setPreset($event)">
            @for (o of ranges; track o.value) {
              <option [value]="o.value">{{ o.label }}</option>
            }
          </select>
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
          <select class="control" [ngModel]="bit()" (ngModelChange)="setBit($event)">
            <option [ngValue]="null">All bits</option>
            @for (b of bits; track b) {
              <option [ngValue]="b">Bit {{ b }}</option>
            }
          </select>
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

    <app-card [padded]="false">
      @if (error(); as e) {
        <div class="pad">
          <app-error-state heading="Alarm history unavailable" [message]="e" (retry)="go(page())" />
        </div>
      } @else if (loading() && !data()) {
        <div class="pad"><app-skeleton height="200px" /></div>
      } @else if (data(); as d) {
        @if (d.data.rows.length) {
          <div class="wrap">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col">Alarm</th>
                  <th scope="col">Machine</th>
                  <th scope="col" class="num">Bit</th>
                  <th scope="col">Start</th>
                  <th scope="col">End</th>
                  <th scope="col" class="num">Duration</th>
                </tr>
              </thead>
              <tbody>
                @for (r of d.data.rows; track $index) {
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
          <div class="pager">
            <span
              >{{ d.pagination.total }} alarms · page {{ d.pagination.page }} of
              {{ d.pagination.total_pages || 1 }}</span
            >
            <div class="pager__buttons">
              <button
                appButton
                variant="secondary"
                size="sm"
                type="button"
                [disabled]="d.pagination.page <= 1 || loading()"
                (click)="go(d.pagination.page - 1)"
              >
                <app-icon name="chevron-left" [size]="14" /> Previous
              </button>
              <button
                appButton
                variant="secondary"
                size="sm"
                type="button"
                [disabled]="d.pagination.page >= d.pagination.total_pages || loading()"
                (click)="go(d.pagination.page + 1)"
              >
                Next <app-icon name="chevron-right" [size]="14" />
              </button>
            </div>
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
  protected readonly preset = signal<RangePreset>('week');
  protected readonly customFrom = signal(toLocalInput(new Date(Date.now() - 24 * 3600 * 1000)));
  protected readonly customTo = signal(toLocalInput(new Date()));
  protected readonly bit = signal<number | null>(null);
  protected readonly page = signal(1);
  protected readonly data = signal<AlarmHistoryPage | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly exporting = signal<'csv' | 'xlsx' | null>(null);

  constructor() {
    effect(() => {
      this.machineId();
      this.go(1);
    });
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
      .history({ ...this.filters(), page, page_size: HISTORY_PAGE_SIZE })
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
