import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Subject,
  catchError,
  combineLatest,
  distinctUntilChanged,
  exhaustMap,
  fromEvent,
  map,
  startWith,
  switchMap,
  tap,
  timer,
} from 'rxjs';

import { ApiError } from '../../core/api/api-error';
import { AlarmsApi } from '../../core/api/resources/alarms.api';
import { ActiveAlarms } from '../../core/models';
import {
  CardComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  IconComponent,
  PaginationComponent,
  SkeletonComponent,
} from '../../shared/ui';
import { formatDateTime, formatDuration, formatRelativeTime } from '../../shared/utils/format';
import { injectNow } from '../../shared/utils/now';
import { SortDirection, sortData, toggleSort } from '../../shared/utils/sort';
import { ActiveAlarmCountService } from './active-alarm-count.service';

/** Active alarms refresh this often while the tab is visible. */
export const ACTIVE_REFRESH_MS = 10_000;

/** Alarms currently active (set bits of each machine's alarm word). */
@Component({
  selector: 'app-active-alarms',
  imports: [
    CardComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    SkeletonComponent,
    IconComponent,
    PaginationComponent,
  ],
  template: `
    <div class="toolbar">
      <p class="muted" aria-live="polite">
        @if (data(); as d) {
          {{ d.alarms.length }} active alarm{{ d.alarms.length === 1 ? '' : 's' }} on
          {{ d.machines_in_alarm }} machine{{ d.machines_in_alarm === 1 ? '' : 's' }} · updated
          {{ relative(d.generated_at) }}
        }
      </p>
    </div>
    <app-card heading="Active Alarms" [padded]="false" expandable="true">
      @if (error(); as e) {
        <div class="pad">
          <app-error-state heading="Active alarms unavailable" [message]="e" (retry)="refresh()" />
        </div>
      } @else if (data(); as d) {
        @if (d.alarms.length) {
          <div class="wrap table-sticky-container">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col" class="num th-sortable" (click)="toggleSort('bit')" tabindex="0" (keydown.enter)="toggleSort('bit')">
                    <span class="th-sort-content">
                      Bit No
                      <app-icon
                        [name]="sortKey() === 'bit' ? (sortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                        [size]="13"
                        [class.sort-icon-active]="sortKey() === 'bit'"
                        [class.sort-icon-muted]="sortKey() !== 'bit'"
                      />
                    </span>
                  </th>
                  <th scope="col" class="th-sortable" (click)="toggleSort('name')" tabindex="0" (keydown.enter)="toggleSort('name')">
                    <span class="th-sort-content">
                      Alarm explanation
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
                  <th scope="col" class="th-sortable" (click)="toggleSort('since')" tabindex="0" (keydown.enter)="toggleSort('since')">
                    <span class="th-sort-content">
                      Active since
                      <app-icon
                        [name]="sortKey() === 'since' ? (sortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                        [size]="13"
                        [class.sort-icon-active]="sortKey() === 'since'"
                        [class.sort-icon-muted]="sortKey() !== 'since'"
                      />
                    </span>
                  </th>
                  <th scope="col" class="num">Duration</th>
                  <th scope="col" class="th-sortable" (click)="toggleSort('stale')" tabindex="0" (keydown.enter)="toggleSort('stale')">
                    <span class="th-sort-content">
                      Data
                      <app-icon
                        [name]="sortKey() === 'stale' ? (sortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                        [size]="13"
                        [class.sort-icon-active]="sortKey() === 'stale'"
                        [class.sort-icon-muted]="sortKey() !== 'stale'"
                      />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (a of pagedAlarms(); track a.tag_id + '-' + a.bit) {
                  <tr>
                    <td class="num mono">{{ a.bit }}</td>
                    <td>
                      <span class="alarm-name" [class.alarm-name--unnamed]="!a.named">{{
                        a.name
                      }}</span>
                      @if (a.message) {
                        <div class="sub">{{ a.message }}</div>
                      }
                    </td>
                    <td>
                      {{ a.machine_name }}
                      <div class="sub">
                        {{ a.plant_name }}{{ a.area_name ? ' · ' + a.area_name : '' }}
                      </div>
                    </td>
                    <td>
                      {{
                        a.since
                          ? (a.since_is_estimate ? 'at least since ' : '') + dateTime(a.since)
                          : '—'
                      }}
                    </td>
                    <td class="num mono">{{ duration(a.since) }}</td>
                    <td>
                      @if (a.stale) {
                        <span class="pill" title="No recent data from the PLC: last known state"
                          >last known</span
                        >
                      } @else {
                        <span class="pill pill--ok">live</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="table-pagination">
            <app-pagination
              [page]="page()"
              [pageSize]="pageSize()"
              [total]="data()?.alarms?.length || 0"
              (pageChange)="page.set($event)"
              (pageSizeChange)="pageSize.set($event); page.set(1)"
            />
          </div>
        } @else {
          <div class="pad">
            <app-empty-state
              heading="No active alarms"
              [message]="d.notes[0] || 'All machines with an alarm word report no alarms.'"
            />
          </div>
        }
        @if (d.alarms.length && d.notes.length) {
          <ul class="notes pad">
            @for (n of d.notes; track n) {
              <li>{{ n }}</li>
            }
          </ul>
        }
      } @else {
        <div class="pad"><app-skeleton height="160px" /></div>
      }
    </app-card>
  `,
  styleUrl: './alarms.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveAlarmsComponent {
  /** Only this machine; null = every machine in scope. */
  readonly machineId = input<number | null>(null);

  private readonly api = inject(AlarmsApi);
  private readonly counter = inject(ActiveAlarmCountService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly now = injectNow(1000);

  protected readonly data = signal<ActiveAlarms | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly sortKey = signal<string | null>(null);
  protected readonly sortDir = signal<SortDirection>('asc');

  protected readonly sortedAlarms = computed(() => {
    const alarms = this.data()?.alarms || [];
    const key = this.sortKey();
    if (!key) return alarms;
    return sortData(alarms, (a: any) => a[key], this.sortDir());
  });

  protected readonly pagedAlarms = computed(() => {
    const list = this.sortedAlarms();
    const p = this.page();
    const sz = this.pageSize();
    return list.slice((p - 1) * sz, p * sz);
  });

  protected toggleSort(key: string): void {
    toggleSort(this.sortKey, this.sortDir, key);
  }

  private readonly machine$ = new Subject<number | null>();
  private readonly refresh$ = new Subject<void>();

  constructor() {
    effect(() => this.machine$.next(this.machineId()));
    const visible$ = fromEvent(this.document, 'visibilitychange').pipe(
      startWith(null),
      map(() => this.document.visibilityState !== 'hidden'),
      distinctUntilChanged(),
    );
    combineLatest([this.machine$, visible$, this.refresh$.pipe(startWith(undefined))])
      .pipe(
        switchMap(([machine, visible]) =>
          visible ? timer(0, ACTIVE_REFRESH_MS).pipe(map(() => machine)) : EMPTY,
        ),
        exhaustMap((machine) =>
          this.api.active(machine ? { machine_id: machine } : {}).pipe(
            tap((d) => {
              this.data.set(d);
              this.error.set(null);
              if (!machine) this.counter.report(d.alarms.length);
            }),
            catchError((e) => {
              this.error.set(ApiError.from(e).message);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  refresh(): void {
    this.refresh$.next();
  }

  protected duration(since: string | null): string {
    return since ? formatDuration((this.now() - new Date(since).getTime()) / 1000) : '—';
  }

  protected dateTime(ts: string): string {
    return formatDateTime(ts);
  }

  protected relative(ts: string): string {
    return formatRelativeTime(ts, this.now());
  }
}
