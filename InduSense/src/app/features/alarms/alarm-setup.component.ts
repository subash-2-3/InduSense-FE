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
  IconComponent,
  PaginationComponent,
  SearchableSelectComponent,
  SelectOption,
  SkeletonComponent,
} from '../../shared/ui';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { SortDirection, sortData, toggleSort } from '../../shared/utils/sort';

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
  imports: [
    FormsModule,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    IconComponent,
    PaginationComponent,
    SearchableSelectComponent,
    SkeletonComponent,
  ],
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
            <app-searchable-select
              ariaLabel="Alarm word"
              [options]="tagOptions()"
              [ngModel]="tagId()"
              (ngModelChange)="tagId.set($event)"
            />
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
              Save alarm master
            </button>
          </div>
        }
      </div>

      <app-card [padded]="false">
        @if (loading()) {
          <div class="pad"><app-skeleton height="240px" /></div>
        } @else {
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
                  <th scope="col" class="th-sortable" (click)="toggleSort('message')" tabindex="0" (keydown.enter)="toggleSort('message')">
                    <span class="th-sort-content">
                      Action / note (optional)
                      <app-icon
                        [name]="sortKey() === 'message' ? (sortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                        [size]="13"
                        [class.sort-icon-active]="sortKey() === 'message'"
                        [class.sort-icon-muted]="sortKey() !== 'message'"
                      />
                    </span>
                  </th>
                  <th scope="col" class="th-sortable" (click)="toggleSort('active')" tabindex="0" (keydown.enter)="toggleSort('active')">
                    <span class="th-sort-content">
                      Enabled
                      <app-icon
                        [name]="sortKey() === 'active' ? (sortDir() === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'"
                        [size]="13"
                        [class.sort-icon-active]="sortKey() === 'active'"
                        [class.sort-icon-muted]="sortKey() !== 'active'"
                      />
                    </span>
                  </th>
                  <th scope="col">Now</th>
                </tr>
              </thead>
              <tbody>
                @for (r of pagedRows(); track r.bit) {
                  <tr [class.row--on]="on(r.bit)">
                    <td class="num mono">{{ r.bit }}</td>
                    <td>
                      <input
                        class="control control--wide"
                        [attr.aria-label]="'Explanation of bit ' + r.bit"
                        maxlength="200"
                        [placeholder]="'Alarm bit ' + r.bit"
                        [readonly]="!canManage()"
                        [(ngModel)]="r.name"
                      />
                    </td>
                    <td>
                      <input
                        class="control control--wide"
                        [attr.aria-label]="'Note of bit ' + r.bit"
                        maxlength="500"
                        [placeholder]="'Note for bit ' + r.bit"
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
                    <td>
                      @if (on(r.bit)) {
                        <span class="pill pill--on">active</span>
                      } @else {
                        <span class="muted">—</span>
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
              [total]="rows().length"
              (pageChange)="page.set($event)"
              (pageSizeChange)="pageSize.set($event); page.set(1)"
            />
          </div>
          <p class="muted pad">
            The alarm master: when bit N of the alarm word is set, Active alarms and History show
            its explanation. Bit 0 is the least significant bit. Bits without an explanation appear
            as "Alarm bit N"; a disabled bit is ignored.
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
    .row--on td {
      background: rgb(239 68 68 / 6%);
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
  protected readonly tagOptions = computed<SelectOption[]>(() =>
    this.tags().map((t) => ({
      value: t.tag_id,
      label:
        `${t.machine_name} · ${t.display_name || t.tag_name}` +
        (t.register_address ? ` (${t.register_address})` : ''),
    })),
  );
  protected readonly tag = computed(
    () => this.tags().find((t) => t.tag_id === this.tagId()) ?? null,
  );
  protected readonly rows = signal<BitRow[]>(rowsFrom([]));
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(32);
  protected readonly sortKey = signal<string | null>(null);
  protected readonly sortDir = signal<SortDirection>('asc');
  private savedDefinitions: AlarmDefinition[] = [];

  protected readonly sortedRows = computed(() => {
    const r = this.rows();
    const k = this.sortKey();
    if (!k) return r;
    return sortData(r, (row: any) => row[k], this.sortDir());
  });

  protected readonly pagedRows = computed(() => {
    const list = this.sortedRows();
    const p = this.page();
    const sz = this.pageSize();
    return list.slice((p - 1) * sz, p * sz);
  });

  protected toggleSort(key: string): void {
    toggleSort(this.sortKey, this.sortDir, key);
  }

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
