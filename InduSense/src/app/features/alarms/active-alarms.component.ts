import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
  SkeletonComponent,
} from '../../shared/ui';
import { formatDateTime, formatDuration, formatRelativeTime } from '../../shared/utils/format';
import { injectNow } from '../../shared/utils/now';
import { ActiveAlarmCountService } from './active-alarm-count.service';

/** Active alarms refresh this often while the tab is visible. */
export const ACTIVE_REFRESH_MS = 10_000;

/** Alarms currently active (set bits of each machine's alarm word). */
@Component({
  selector: 'app-active-alarms',
  imports: [CardComponent, EmptyStateComponent, ErrorStateComponent, SkeletonComponent],
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
    <app-card [padded]="false">
      @if (error(); as e) {
        <div class="pad">
          <app-error-state heading="Active alarms unavailable" [message]="e" (retry)="refresh()" />
        </div>
      } @else if (data(); as d) {
        @if (d.alarms.length) {
          <div class="wrap">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col" class="num">Bit No</th>
                  <th scope="col">Alarm explanation</th>
                  <th scope="col">Machine</th>
                  <th scope="col">Active since</th>
                  <th scope="col" class="num">Duration</th>
                  <th scope="col">Data</th>
                </tr>
              </thead>
              <tbody>
                @for (a of d.alarms; track a.tag_id + '-' + a.bit) {
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
