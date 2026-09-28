import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { noop } from 'rxjs';

import { AlarmsApi } from '../../core/api/resources/alarms.api';
import { ALARM_BITS, AlarmDefinition, AlarmDefinitionItem, AlarmTag } from '../../core/models';
import {
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  SkeletonComponent,
} from '../../shared/ui';
import { ToastService } from '../../shared/ui/toast/toast.service';

export interface BitRow {
  bit: number;
  name: string;
  message: string;
  active: boolean;
}

/** One editable row per bit of the alarm word, filled from the saved names. */
export function rowsFrom(definitions: readonly AlarmDefinition[]): BitRow[] {
  const byBit = new Map(definitions.map((d) => [d.bit, d]));
  return Array.from({ length: ALARM_BITS }, (_, bit) => {
    const d = byBit.get(bit);
    return {
      bit,
      name: d?.name ?? '',
      message: d?.message ?? '',
      active: d ? d.status === 'active' : true,
    };
  });
}

/** Rows with a name become definitions; rows without one are not sent (their names are removed). */
export function itemsFrom(rows: readonly BitRow[]): AlarmDefinitionItem[] {
  return rows
    .filter((r) => r.name.trim())
    .map((r) => ({
      bit: r.bit,
      name: r.name.trim(),
      message: r.message.trim() || null,
      status: r.active ? 'active' : 'inactive',
    }));
}

/** Whether `bit` is set in an alarm word. */
export function isSet(word: number | null | undefined, bit: number): boolean {
  return word !== null && word !== undefined && word >= 0 && Math.floor(word / 2 ** bit) % 2 === 1;
}

/** Names for the bits of one alarm word (alarms:manage edits, others read). */
@Component({
  selector: 'app-alarm-setup',
  imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent],
  template: `
    @if (tags().length === 0) {
      <app-card>
        <app-empty-state
          heading="No alarm words"
          message="Map a machine's alarm status tag (ALARM_STATUS) in Assets to name its alarm bits here."
        />
      </app-card>
    } @else {
      <div class="toolbar">
        <div class="toolbar__group">
          <label class="fl">
            <span>Alarm word</span>
            <select class="control" [ngModel]="tagId()" (ngModelChange)="tagId.set($event)">
              @for (t of tags(); track t.tag_id) {
                <option [ngValue]="t.tag_id">
                  {{ t.machine_name }} · {{ t.display_name || t.tag_name
                  }}{{ t.register_address ? ' (' + t.register_address + ')' : '' }}
                </option>
              }
            </select>
          </label>
          @if (tag(); as t) {
            <span class="muted">
              Current value {{ t.value ?? '—' }} · {{ t.named_bits }} named bit{{
                t.named_bits === 1 ? '' : 's'
              }}
            </span>
          }
        </div>
        @if (canManage()) {
          <div class="toolbar__group">
            <button appButton variant="ghost" type="button" [disabled]="saving()" (click)="reset()">
              Undo changes
            </button>
            <button
              appButton
              variant="primary"
              type="button"
              [loading]="saving()"
              [disabled]="saving() || loading()"
              (click)="save()"
            >
              Save names
            </button>
          </div>
        }
      </div>

      <app-card [padded]="false">
        @if (loading()) {
          <div class="pad"><app-skeleton height="240px" /></div>
        } @else {
          <div class="wrap">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col" class="num">Bit</th>
                  <th scope="col">Now</th>
                  <th scope="col">Alarm name</th>
                  <th scope="col">Message / action</th>
                  <th scope="col">Enabled</th>
                </tr>
              </thead>
              <tbody>
                @for (r of rows(); track r.bit) {
                  <tr>
                    <td class="num mono">{{ r.bit }}</td>
                    <td>
                      @if (on(r.bit)) {
                        <span class="pill pill--on">active</span>
                      } @else {
                        <span class="muted">—</span>
                      }
                    </td>
                    <td>
                      <input
                        class="control"
                        [attr.aria-label]="'Name of bit ' + r.bit"
                        maxlength="200"
                        [placeholder]="'Alarm bit ' + r.bit"
                        [readonly]="!canManage()"
                        [(ngModel)]="r.name"
                      />
                    </td>
                    <td>
                      <input
                        class="control control--wide"
                        [attr.aria-label]="'Message of bit ' + r.bit"
                        maxlength="500"
                        [readonly]="!canManage()"
                        [(ngModel)]="r.message"
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        [attr.aria-label]="'Bit ' + r.bit + ' enabled'"
                        [disabled]="!canManage()"
                        [(ngModel)]="r.active"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="muted pad">
            Bit 0 is the least significant bit. Unnamed bits still appear as "Alarm bit N"; a
            disabled bit is ignored in active alarms and history.
          </p>
        }
      </app-card>
    }
  `,
  styleUrl: './alarms.scss',
  styles: `
    .control--wide {
      width: 100%;
      min-width: 240px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlarmSetupComponent {
  readonly tags = input<readonly AlarmTag[]>([]);
  readonly canManage = input(false);
  /** Emitted after names were saved (the page reloads the alarm words). */
  readonly saved = output<void>();

  private readonly api = inject(AlarmsApi);
  private readonly toast = inject(ToastService);

  protected readonly tagId = signal<number | null>(null);
  protected readonly tag = computed(
    () => this.tags().find((t) => t.tag_id === this.tagId()) ?? null,
  );
  protected readonly rows = signal<BitRow[]>(rowsFrom([]));
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  private savedDefinitions: AlarmDefinition[] = [];

  constructor() {
    effect(() => {
      const tags = this.tags();
      if (!tags.some((t) => t.tag_id === this.tagId())) {
        this.tagId.set(tags[0]?.tag_id ?? null);
      }
    });
    effect(() => {
      const id = this.tagId();
      if (id !== null) this.load(id);
    });
  }

  protected on(bit: number): boolean {
    return isSet(this.tag()?.value, bit);
  }

  private load(tagId: number): void {
    this.loading.set(true);
    this.api.definitions(tagId).subscribe({
      next: (definitions) => {
        this.savedDefinitions = definitions;
        this.rows.set(rowsFrom(definitions));
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.toast.error(e, 'Unable to load the alarm names.');
      },
    });
  }

  protected reset(): void {
    this.rows.set(rowsFrom(this.savedDefinitions));
  }

  protected save(): void {
    const tagId = this.tagId();
    if (tagId === null) return;
    this.saving.set(true);
    this.api.saveDefinitions(tagId, itemsFrom(this.rows())).subscribe({
      next: (definitions) => {
        this.savedDefinitions = definitions;
        this.rows.set(rowsFrom(definitions));
        this.saving.set(false);
        this.toast.success('Alarm names saved.');
        this.saved.emit();
      },
      error: () => this.saving.set(false), // the error toast comes from errorToastInterceptor
      complete: noop,
    });
  }
}
