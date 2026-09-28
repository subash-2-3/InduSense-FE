import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, exhaustMap, switchMap, tap, timer } from 'rxjs';

import { ApiError } from '../../core/api/api-error';
import { CommandsApi } from '../../core/api/resources/commands.api';
import { ControlTag, MachineControls } from '../../core/models';
import {
  ButtonComponent,
  ModalComponent,
  SkeletonComponent,
  StatusPillComponent,
  ToastService,
} from '../../shared/ui';
import { formatDateTime } from '../../shared/utils/format';
import { statusLabel, statusTone } from '../../shared/utils/status-colors';
import { ControlAction, actionsFor, commandSummary, isOpen } from './machine-control';

/** The control panel refreshes this often while open (command progress, register values). */
export const CONTROLS_REFRESH_MS = 2_000;

/**
 * Machine control panel: sends register writes (Start/Stop, resets, interlock) through the
 * DataLogger. Every command is confirmed first and its progress is shown until done / failed.
 */
@Component({
  selector: 'app-machine-control-dialog',
  imports: [ButtonComponent, ModalComponent, SkeletonComponent, StatusPillComponent],
  template: `
    <app-modal
      [open]="machineId() !== null"
      [title]="'Controls · ' + (data()?.machine_name ?? '')"
      subtitle="Commands are written to the PLC by the DataLogger"
      maxWidth="720px"
      (close)="closed.emit()"
    >
      @if (error(); as e) {
        <p class="error" role="alert">{{ e }}</p>
      } @else if (data(); as d) {
        <div class="head">
          <div>
            <span class="muted">Machine state</span>
            <app-status-pill dot [label]="label(d.state.status)" [tone]="tone(d.state.status)" />
          </div>
          <div class="muted">
            Device: {{ d.device_name ?? '—' }}
            @if (d.state.last_data_at) {
              · data {{ dateTime(d.state.last_data_at) }}
            }
          </div>
        </div>
        @for (n of d.notes; track n) {
          <p class="note">{{ n }}</p>
        }
        <ul class="controls">
          @for (c of d.controls; track c.tag_id) {
            <li class="control">
              <div class="control__head">
                <div>
                  <strong>{{ c.label }}</strong>
                  <span class="muted mono">{{ c.register_address }} · {{ c.write_mode }}</span>
                </div>
                @if (c.write_mode === 'latched') {
                  <span class="muted"
                    >Now: <strong>{{ valueName(c) }}</strong></span
                  >
                }
              </div>
              <div class="control__actions">
                @for (a of actions(c); track a.value) {
                  <button
                    appButton
                    [variant]="a.current ? 'secondary' : 'primary'"
                    size="sm"
                    type="button"
                    [disabled]="!d.can_write || busy(c) || a.current"
                    [attr.aria-pressed]="c.write_mode === 'latched' ? a.current : null"
                    (click)="send(c, a)"
                  >
                    {{ a.label }}
                  </button>
                }
              </div>
              @if (c.last_command; as cmd) {
                <p class="status" [attr.data-tone]="summary(cmd).tone" aria-live="polite">
                  {{ summary(cmd).text }} · {{ dateTime(cmd.requested_at) }}
                </p>
              }
            </li>
          } @empty {
            <li class="muted">No writable tags on this machine's device.</li>
          }
        </ul>
      } @else {
        <app-skeleton height="160px" />
      }
    </app-modal>
  `,
  styles: `
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      margin-bottom: var(--space-3);
    }
    .head > div:first-child {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .muted {
      font-size: var(--fs-sm);
      color: var(--text-muted);
    }
    .mono {
      margin-left: var(--space-2);
      font-family: var(--font-mono);
      font-size: var(--fs-xs);
    }
    .note {
      margin: 0 0 var(--space-2);
      font-size: var(--fs-sm);
      color: var(--status-warning);
    }
    .error {
      color: var(--status-fault-text);
    }
    .controls {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .control {
      padding: var(--space-3);
      border: 1px solid var(--border-card);
      border-radius: var(--radius-md);
    }
    .control__head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
    }
    .control__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-top: var(--space-2);
    }
    .status {
      margin: var(--space-2) 0 0;
      font-size: var(--fs-sm);
      color: var(--text-secondary);
    }
    .status[data-tone='running'] {
      color: var(--status-running);
    }
    .status[data-tone='fault'] {
      color: var(--status-fault-text);
    }
    .status[data-tone='warning'] {
      color: var(--status-warning);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MachineControlDialogComponent {
  /** The machine whose controls are shown; null = closed. */
  readonly machineId = input<number | null>(null);
  readonly closed = output<void>();

  private readonly api = inject(CommandsApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly data = signal<MachineControls | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly sending = signal<number | null>(null);
  private readonly machine$ = new Subject<number | null>();
  private readonly status = computed(() => this.data()?.state.status ?? 'UNKNOWN');

  constructor() {
    effect(() => {
      const id = this.machineId();
      this.data.set(null);
      this.error.set(null);
      this.machine$.next(id);
    });
    this.machine$
      .pipe(
        switchMap((id) =>
          id === null ? EMPTY : timer(0, CONTROLS_REFRESH_MS).pipe(exhaustMap(() => this.load(id))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private load(id: number) {
    return this.api.controls(id).pipe(
      tap((controls) => {
        this.data.set(controls);
        this.error.set(null);
      }),
      catchError((e) => {
        this.error.set(ApiError.from(e).message);
        return EMPTY;
      }),
    );
  }

  protected actions(control: ControlTag): ControlAction[] {
    return actionsFor(control, this.status(), this.data()?.machine_name ?? '');
  }

  protected busy(control: ControlTag): boolean {
    return this.sending() === control.tag_id || isOpen(control.last_command);
  }

  protected send(control: ControlTag, action: ControlAction): void {
    const device = this.data()?.device_id;
    if (device == null || !confirm(action.confirm)) {
      return;
    }
    this.sending.set(control.tag_id);
    this.api.send(device, control.tag_id, action.value).subscribe({
      next: (command) => {
        this.sending.set(null);
        this.data.update((d) =>
          d
            ? {
                ...d,
                controls: d.controls.map((c) =>
                  c.tag_id === control.tag_id ? { ...c, last_command: command } : c,
                ),
              }
            : d,
        );
        this.toast.success(`"${action.label}" sent to the DataLogger.`);
      },
      error: () => this.sending.set(null), // the error toast comes from errorToastInterceptor
    });
  }

  protected valueName(control: ControlTag): string {
    return control.value === null
      ? '—'
      : control.value === 1
        ? 'On'
        : control.value === 0
          ? 'Off'
          : String(control.value);
  }

  protected summary = commandSummary;
  protected label = statusLabel;
  protected tone = statusTone;

  protected dateTime(ts: string): string {
    return formatDateTime(ts);
  }
}
