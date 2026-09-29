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
  StatusPillComponent,
} from '../../shared/ui';
import { formatDuration, formatNumber, formatPercent } from '../../shared/utils/format';
import { statusLabel, statusTone } from '../../shared/utils/status-colors';
import { MachineControlDialogComponent } from '../machines/machine-control-dialog.component';
import { formatQuantity } from './energy-charts';
import { EnergyFilterState } from './energy-filters.component';
import { rangeFor } from './energy-range';

/** Machine state and counts refresh this often while the tab is visible. */
export const MACHINES_REFRESH_MS = 10_000;

/** Order of the state chips in the summary (others follow alphabetically). */
const STATE_ORDER = ['RUNNING', 'IDLE', 'STOPPED', 'ALARM', 'OFFLINE', 'UNKNOWN'];

export function stateChips(byState: Record<string, number>): { state: string; count: number }[] {
  return Object.entries(byState)
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => {
      const ia = STATE_ORDER.indexOf(a.state);
      const ib = STATE_ORDER.indexOf(b.state);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.state.localeCompare(b.state);
    });
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
    StatusPillComponent,
    MachineControlDialogComponent,
  ],
  template: `
    <section aria-labelledby="machines-title" class="section">
      <div class="section__head">
        <h2 id="machines-title" class="section__title">Machines</h2>
        @if (data(); as d) {
          <div class="chips" aria-label="Machines per state">
            @for (c of chips(); track c.state) {
              <app-status-pill
                dot
                [label]="label(c.state) + ' ' + c.count"
                [tone]="tone(c.state)"
              />
            }
          </div>
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
                  <div class="machine__head">
                    <div>
                      <h3 class="machine__name">{{ m.machine_name }}</h3>
                      <p class="machine__meta">
                        {{ m.machine_code }} · {{ m.plant_name
                        }}{{ m.area_name ? ' · ' + m.area_name : '' }}
                      </p>
                    </div>
                    <app-status-pill
                      dot
                      [label]="label(m.state.status)"
                      [tone]="tone(m.state.status)"
                    />
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
  protected readonly chips = computed(() => stateChips(this.data()?.summary.by_state ?? {}));
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

  protected label = statusLabel;
  protected tone = statusTone;
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
