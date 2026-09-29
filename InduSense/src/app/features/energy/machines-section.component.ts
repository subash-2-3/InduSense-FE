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
import { RouterLink } from '@angular/router';
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
import { EnergyApi } from '../../core/api/resources/energy.api';
import { AuthService } from '../../core/auth/auth.service';
import { Permission } from '../../core/auth/permissions';
import { MachinesOverview } from '../../core/models';
import {
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  SkeletonComponent,
} from '../../shared/ui';
import { formatDuration, formatNumber, formatPercent } from '../../shared/utils/format';
import { MachineControlDialogComponent } from '../machines/machine-control-dialog.component';
import { formatQuantity } from './energy-charts';
import { EnergyFilterState } from './energy-filters.component';
import { rangeFor } from './energy-range';

/** Machine state and counts refresh this often while the tab is visible. */
export const MACHINES_REFRESH_MS = 10_000;

export type LampTone = 'run' | 'idle' | 'stop' | 'none';

export interface MachineLamp {
  label: string;
  tone: LampTone;
}

/**
 * The status light of a machine: machine_status 0 = Run (green), 1 = Idle (yellow), 2 = Stop (red).
 * The state map turns those values into RUNNING / IDLE / ALARM; a stopped or faulted machine is
 * also shown as Stop. Without current data: Offline / Unknown (grey).
 */
export function machineLamp(status: string | null | undefined): MachineLamp {
  switch ((status ?? '').toUpperCase()) {
    case 'RUNNING':
      return { label: 'Run', tone: 'run' };
    case 'IDLE':
      return { label: 'Idle', tone: 'idle' };
    case 'ALARM':
    case 'STOPPED':
    case 'FAULT':
      return { label: 'Stop', tone: 'stop' };
    case 'OFFLINE':
      return { label: 'Offline', tone: 'none' };
    default:
      return { label: 'Unknown', tone: 'none' };
  }
}

const LAMP_ORDER = ['Run', 'Idle', 'Stop', 'Offline', 'Unknown'];

/** Machines per status light, in the order Run, Idle, Stop, Offline, Unknown. */
export function lampChips(byState: Record<string, number>): (MachineLamp & { count: number })[] {
  const counts = new Map<string, MachineLamp & { count: number }>();
  for (const [state, count] of Object.entries(byState)) {
    const lamp = machineLamp(state);
    const entry = counts.get(lamp.label) ?? { ...lamp, count: 0 };
    entry.count += count;
    counts.set(lamp.label, entry);
  }
  return [...counts.values()].sort(
    (a, b) => LAMP_ORDER.indexOf(a.label) - LAMP_ORDER.indexOf(b.label),
  );
}

/** Machines of the combined dashboard: state, production count, availability, alarms, controls. */
@Component({
  selector: 'app-machines-section',
  imports: [
    RouterLink,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    SkeletonComponent,
    MachineControlDialogComponent,
  ],
  template: `
    <section aria-labelledby="machines-title" class="section">
      <div class="section__head">
        <h2 id="machines-title" class="section__title">Machines</h2>
        @if (data(); as d) {
          <ul class="chips" aria-label="Machines per status">
            @for (c of chips(); track c.label) {
              <li class="lamp lamp--chip" [attr.data-tone]="c.tone">
                <span class="lamp__light" aria-hidden="true"></span>
                <span class="lamp__label">{{ c.label }}</span>
                <span class="lamp__count">{{ c.count }}</span>
              </li>
            }
          </ul>
        }
      </div>

      @if (error(); as e) {
        <app-card
          ><app-error-state heading="Machines unavailable" [message]="e" (retry)="refresh()"
        /></app-card>
      } @else if (data(); as d) {
        @if (d.machines.length) {
          <div class="kpis">
            <div class="kpi">
              <span class="kpi__label">Machines running</span>
              <span class="kpi__value"
                ><span class="text-ok">{{ d.summary.running }}</span> /
                {{ d.summary.machines }}</span
              >
            </div>
            <div class="kpi">
              <span class="kpi__label">Production</span>
              <span class="kpi__value">{{ quantity(d.summary.production) }}</span>
            </div>
            <div class="kpi">
              <span class="kpi__label">Availability</span>
              <span class="kpi__value">{{ percent(d.summary.availability) }}</span>
            </div>
            <div class="kpi">
              <span class="kpi__label">Active alarms</span>
              <span class="kpi__value" [class.text-alarm]="d.summary.active_alarms > 0">
                {{ d.summary.active_alarms }}
                @if (d.summary.in_alarm) {
                  <small class="kpi__sub"
                    >on {{ d.summary.in_alarm }} machine{{
                      d.summary.in_alarm === 1 ? '' : 's'
                    }}</small
                  >
                }
              </span>
            </div>
          </div>

          <div class="machine-grid">
            @for (m of d.machines; track m.machine_id) {
              <app-card>
                <div class="machine" [attr.data-state]="m.state.status">
                  @let lamp = lampOf(m.state.status);
                  <div class="machine__head">
                    <div class="machine__title">
                      <span
                        class="lamp lamp--big"
                        [attr.data-tone]="lamp.tone"
                        role="img"
                        [attr.aria-label]="m.machine_name + ' status: ' + lamp.label"
                      >
                        <span class="lamp__light"></span>
                      </span>
                      <div>
                        <h3 class="machine__name">{{ m.machine_name }}</h3>
                        <p class="machine__meta">
                          {{ m.machine_code }} · {{ m.plant_name
                          }}{{ m.area_name ? ' · ' + m.area_name : '' }}
                        </p>
                      </div>
                    </div>
                    <span class="lamp lamp--label" [attr.data-tone]="lamp.tone">{{
                      lamp.label
                    }}</span>
                  </div>

                  <dl class="figures">
                    <div class="figure figure--big">
                      <dt>Production</dt>
                      <dd>
                        {{ m.production ? number(m.production.value) : '—' }}
                        <span class="unit">{{ m.production?.unit ?? '' }}</span>
                      </dd>
                      @if (m.counter) {
                        <span class="figure__sub">counter {{ number(m.counter.value) }}</span>
                      }
                    </div>
                    <div class="figure">
                      <dt>Availability</dt>
                      <dd>{{ percent(m.availability) }}</dd>
                    </div>
                    <div class="figure">
                      <dt>Run time</dt>
                      <dd>{{ duration(m.run_seconds) }}</dd>
                    </div>
                    <div class="figure">
                      <dt>Stop time</dt>
                      <dd>{{ duration(m.stop_seconds) }}</dd>
                    </div>
                  </dl>

                  @if (m.active_alarms) {
                    <a class="alarms" routerLink="/alarms">
                      <strong
                        >{{ m.active_alarms }} active alarm{{
                          m.active_alarms === 1 ? '' : 's'
                        }}:</strong
                      >
                      {{ m.alarm_names.join(', ')
                      }}{{ m.active_alarms > m.alarm_names.length ? ', …' : '' }}
                    </a>
                  }

                  @if (canControl() && m.has_controls) {
                    <div class="machine__actions">
                      <button
                        appButton
                        variant="secondary"
                        size="sm"
                        type="button"
                        (click)="controlled.set(m.machine_id)"
                      >
                        Controls
                      </button>
                    </div>
                  }
                </div>
              </app-card>
            }
          </div>
        } @else {
          <app-card>
            <app-empty-state
              compact
              heading="No machines"
              [message]="d.metadata.notes[0] || 'No active machine in this selection.'"
            />
          </app-card>
        }
      } @else {
        <div class="machine-grid"><app-skeleton height="200px" /></div>
      }
    </section>

    <app-machine-control-dialog [machineId]="controlled()" (closed)="controlled.set(null)" />
  `,
  styles: `
    .section {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .section__head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
    }
    .section__title {
      margin: 0;
      font-size: var(--fs-lg);
      font-weight: var(--fw-semibold);
      color: var(--text-primary);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    /* Status light: 0 Run = green, 1 Idle = yellow, 2 Stop = red, no data = grey. */
    .lamp {
      --lamp: var(--status-stopped);
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
    }
    .lamp[data-tone='run'] {
      --lamp: var(--status-running);
    }
    .lamp[data-tone='idle'] {
      --lamp: var(--status-warning);
    }
    .lamp[data-tone='stop'] {
      --lamp: var(--status-fault);
    }
    .lamp__light {
      flex: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--lamp);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--lamp) 25%, transparent);
    }
    .lamp--big .lamp__light {
      width: 22px;
      height: 22px;
      box-shadow:
        0 0 0 4px color-mix(in srgb, var(--lamp) 22%, transparent),
        0 0 14px color-mix(in srgb, var(--lamp) 55%, transparent);
    }
    .lamp[data-tone='none'] .lamp__light {
      box-shadow: none;
    }
    .lamp--chip {
      padding: 4px 10px;
      border: 1px solid var(--border-card);
      border-radius: var(--radius-pill);
      background: var(--bg-card);
      font-size: var(--fs-sm);
      color: var(--text-primary);
    }
    .lamp__count {
      font-family: var(--font-mono);
      font-weight: var(--fw-bold);
    }
    .lamp--label {
      padding: 2px 12px;
      border-radius: var(--radius-pill);
      background: color-mix(in srgb, var(--lamp) 16%, transparent);
      color: var(--lamp);
      font-size: var(--fs-sm);
      font-weight: var(--fw-bold);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .machine__title {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: var(--gap-grid);
    }
    .kpi {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-3) var(--space-4);
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: var(--radius-card);
    }
    .kpi__label,
    .figure dt {
      font-size: var(--fs-xs);
      font-weight: var(--fw-semibold);
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .kpi__value {
      font-family: var(--font-mono);
      font-size: var(--fs-xl);
      font-weight: var(--fw-bold);
      color: var(--text-primary);
    }
    .kpi__sub,
    .figure__sub {
      display: block;
      font-family: var(--font-sans);
      font-size: var(--fs-xs);
      font-weight: var(--fw-regular);
      color: var(--text-muted);
    }
    .text-ok {
      color: var(--status-running);
    }
    .text-alarm {
      color: var(--status-fault-text);
    }
    .machine-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
      gap: var(--gap-grid);
    }
    .machine {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .machine__head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-2);
    }
    .machine__name {
      margin: 0;
      font-size: var(--fs-md);
      font-weight: var(--fw-semibold);
      color: var(--text-primary);
    }
    .machine__meta {
      margin: 2px 0 0;
      font-size: var(--fs-xs);
      color: var(--text-muted);
    }
    .figures {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-2);
      margin: 0;
    }
    .figure {
      padding: var(--space-2) var(--space-3);
      background: var(--bg-topbar);
      border: 1px solid var(--border-card);
      border-radius: var(--radius-md);
    }
    .figure dd {
      margin: 2px 0 0;
      font-family: var(--font-mono);
      font-size: var(--fs-md);
      font-weight: var(--fw-semibold);
      color: var(--text-primary);
    }
    .figure--big {
      grid-column: 1 / -1;
    }
    .figure--big dd {
      font-size: var(--fs-xl);
    }
    .unit {
      font-size: var(--fs-sm);
      color: var(--text-secondary);
    }
    .alarms {
      display: block;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      background: rgb(239 68 68 / 12%);
      color: var(--status-fault-text);
      font-size: var(--fs-sm);
      text-decoration: none;
    }
    .alarms:hover,
    .alarms:focus-visible {
      text-decoration: underline;
    }
    .machine__actions {
      display: flex;
      justify-content: flex-end;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MachinesSectionComponent {
  /** The dashboard's filters (scope and period); null until they are known. */
  readonly filters = input<EnergyFilterState | null>(null);

  private readonly api = inject(EnergyApi);
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly canControl = computed(() =>
    this.auth.hasPermission(Permission.DevicesControl),
  );
  protected readonly data = signal<MachinesOverview | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly controlled = signal<number | null>(null);
  protected readonly chips = computed(() => lampChips(this.data()?.summary.by_state ?? {}));
  protected readonly lampOf = machineLamp;
  private readonly filters$ = new Subject<EnergyFilterState>();
  private readonly refresh$ = new Subject<void>();

  constructor() {
    effect(() => {
      const f = this.filters();
      if (f) this.filters$.next(f);
    });
    const visible$ = fromEvent(this.document, 'visibilitychange').pipe(
      startWith(null),
      map(() => this.document.visibilityState !== 'hidden'),
      distinctUntilChanged(),
    );
    combineLatest([this.filters$, visible$, this.refresh$.pipe(startWith(undefined))])
      .pipe(
        switchMap(([f, visible]) =>
          visible ? timer(0, MACHINES_REFRESH_MS).pipe(map(() => f)) : EMPTY,
        ),
        exhaustMap((f) =>
          this.api
            .machines({
              ...f.scope,
              meter_id: undefined,
              ...rangeFor(f.preset, new Date(), f.custom),
            })
            .pipe(
              tap((d) => {
                this.data.set(d);
                this.error.set(null);
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

  protected quantity = formatQuantity;

  protected number(value: number | null | undefined): string {
    return formatNumber(value, { maximumFractionDigits: 0 });
  }

  protected percent(fraction: number | null | undefined): string {
    return formatPercent(fraction, 1);
  }

  protected duration(seconds: number | null | undefined): string {
    return formatDuration(seconds);
  }
}
