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
import { noop } from 'rxjs';
import { FormsModule } from '@angular/forms';

import { TagsApi } from '../../core/api/resources/tags.api';
import { AuthService } from '../../core/auth/auth.service';
import { Permission } from '../../core/auth/permissions';
import { Device, Tag, TagMetadata, TagUpdate } from '../../core/models';
import {
  ButtonComponent,
  IconComponent,
  ModalComponent,
  SkeletonComponent,
  StatusPillComponent,
} from '../../shared/ui';
import { ToastService } from '../../shared/ui/toast/toast.service';
import {
  VISIBLE_STATUSES,
  recordStatusLabel,
  recordStatusTone,
  toggledStatus,
} from '../../shared/utils/record-status';
import { DefaultTagsPickerComponent } from '../tags/default-tags-picker.component';

type TagDraft = Required<Pick<TagUpdate, 'is_counter' | 'is_cumulative'>> & {
  display_name: string;
  unit: string;
  category: string;
  data_type: string;
};

/**
 * The tags of one device. Tags are created by the DataLogger (one row per signal it sees), so
 * this dialog edits their descriptive fields and switches them on or off; an inactive tag's
 * telemetry is no longer stored. Protocol metadata (data id, register) stays read-only.
 */
@Component({
  selector: 'app-device-tags-dialog',
  imports: [
    FormsModule,
    ButtonComponent,
    IconComponent,
    ModalComponent,
    SkeletonComponent,
    StatusPillComponent,
    DefaultTagsPickerComponent,
  ],
  template: `
    <app-modal
      [open]="device() !== null"
      [title]="'Tags of ' + (device()?.name || device()?.external_id || '')"
      subtitle="Signals the DataLogger reports for this device"
      maxWidth="960px"
      (close)="closed.emit()"
    >
      <div class="bar">
        <input
          type="search"
          class="field search"
          placeholder="Search tag name, display name or code"
          aria-label="Search tags"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
        />
        @if (canCreate() && device()?.status === 'active') {
          <button
            appButton
            variant="secondary"
            size="sm"
            type="button"
            [attr.aria-expanded]="showDefaults()"
            (click)="toggleDefaults()"
          >
            <app-icon name="package" [size]="14" />
            {{ showDefaults() ? 'Hide default tags' : 'Add default tags' }}
          </button>
        }
      </div>
      @if (showDefaults()) {
        <section class="defaults" aria-label="Default tags">
          <app-default-tags-picker
            [deviceId]="device()?.id ?? null"
            [metadata]="metadata()"
            [existingCodes]="codes()"
            (added)="onDefaultsAdded()"
          />
        </section>
      }
      @if (loading()) {
        <app-skeleton height="120px" />
      } @else if (filtered().length === 0) {
        <p class="empty">
          No tags yet. They appear when the DataLogger first reports a value, or add default tags.
        </p>
      } @else {
        <div class="wrap">
          <table class="table">
            <thead>
              <tr>
                <th scope="col">Tag</th>
                <th scope="col">EMS / OEE</th>
                <th scope="col">Display name</th>
                <th scope="col">Unit</th>
                <th scope="col">Category</th>
                <th scope="col">Type</th>
                <th scope="col">Counter</th>
                <th scope="col">Status</th>
                <th scope="col" class="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (t of filtered(); track t.id) {
                @if (editingId() === t.id) {
                  <tr>
                    <td class="mono">{{ t.tag_name }}</td>
                    <td>{{ t.tag_type.toUpperCase() }}</td>
                    <td>
                      <input
                        class="field"
                        aria-label="Display name"
                        [(ngModel)]="draft.display_name"
                      />
                    </td>
                    <td><input class="field" aria-label="Unit" [(ngModel)]="draft.unit" /></td>
                    <td>
                      <input class="field" aria-label="Category" [(ngModel)]="draft.category" />
                    </td>
                    <td>
                      <input class="field" aria-label="Data type" [(ngModel)]="draft.data_type" />
                    </td>
                    <td>
                      <label class="check">
                        <input type="checkbox" [(ngModel)]="draft.is_counter" /> counter
                      </label>
                      <label class="check">
                        <input type="checkbox" [(ngModel)]="draft.is_cumulative" /> cumulative
                      </label>
                    </td>
                    <td></td>
                    <td class="num">
                      <button
                        appButton
                        variant="primary"
                        size="sm"
                        type="button"
                        [disabled]="saving()"
                        (click)="save(t)"
                      >
                        Save
                      </button>
                      <button
                        appButton
                        variant="ghost"
                        size="sm"
                        type="button"
                        (click)="editingId.set(null)"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                } @else {
                  <tr>
                    <td class="mono">{{ t.tag_name }}</td>
                    <td>{{ t.tag_type.toUpperCase() }}</td>
                    <td>{{ t.display_name || '—' }}</td>
                    <td>{{ t.unit || '—' }}</td>
                    <td>{{ t.category || '—' }}</td>
                    <td>{{ t.data_type || '—' }}</td>
                    <td>{{ t.is_counter ? 'counter' : t.is_cumulative ? 'cumulative' : '—' }}</td>
                    <td>
                      <app-status-pill
                        [label]="statusLabel(t.status)"
                        [tone]="statusTone(t.status)"
                      />
                    </td>
                    <td class="num">
                      <button
                        appButton
                        variant="ghost"
                        size="sm"
                        type="button"
                        [attr.aria-label]="'Edit tag ' + t.tag_name"
                        (click)="edit(t)"
                      >
                        <app-icon name="edit" [size]="14" />
                      </button>
                      <button appButton variant="ghost" size="sm" type="button" (click)="toggle(t)">
                        {{ t.status === 'active' ? 'Deactivate' : 'Activate' }}
                      </button>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }
    </app-modal>
  `,
  styles: `
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      margin-bottom: var(--space-3);
    }
    .search {
      max-width: 320px;
    }
    .defaults {
      margin-bottom: var(--space-4);
      padding: var(--space-3);
      border: 1px solid var(--border-card);
      border-radius: var(--radius-md);
    }
    .field {
      width: 100%;
      height: 32px;
      padding: 0 var(--space-2);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      background: var(--bg-card);
      color: var(--text-primary);
      font-size: var(--fs-sm);
    }
    .wrap {
      max-height: 60vh;
      overflow: auto;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--fs-sm);
      text-align: left;
    }
    .table th,
    .table td {
      padding: var(--space-2);
      border-bottom: 1px solid var(--border-card);
      vertical-align: middle;
    }
    .table th {
      position: sticky;
      top: 0;
      z-index: 10;
      background: var(--bg-card);
      box-shadow: 0 1px 0 var(--border-card);
      color: var(--text-secondary);
      font-size: var(--fs-xs);
      text-transform: uppercase;
    }
    .num {
      text-align: right;
      white-space: nowrap;
    }
    .mono {
      font-family: var(--font-mono);
    }
    .check {
      display: block;
      white-space: nowrap;
    }
    .empty {
      color: var(--text-secondary);
    }
    @media (max-width: 640px) {
      .bar {
        flex-direction: column;
        align-items: stretch;
      }
      .search {
        max-width: 100%;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceTagsDialogComponent {
  private readonly api = inject(TagsApi);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  /** The device whose tags are shown; null = closed. */
  readonly device = input<Device | null>(null);
  readonly closed = output<void>();

  protected readonly statusLabel = recordStatusLabel;
  protected readonly statusTone = recordStatusTone;
  protected readonly tags = signal<Tag[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly search = signal('');
  protected readonly editingId = signal<number | null>(null);
  protected draft: TagDraft = this.draftOf(null);
  protected readonly canCreate = computed(() => this.auth.hasPermission(Permission.TagsCreate));
  protected readonly showDefaults = signal(false);
  protected readonly metadata = signal<TagMetadata | null>(null);
  protected readonly codes = computed(() => this.tags().map((t) => t.code));

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.tags().filter(
      (t) =>
        !term ||
        t.tag_name.toLowerCase().includes(term) ||
        (t.display_name ?? '').toLowerCase().includes(term) ||
        (t.code ?? '').toLowerCase().includes(term),
    );
  });

  constructor() {
    effect(() => {
      const device = this.device();
      this.tags.set([]);
      this.search.set('');
      this.editingId.set(null);
      this.showDefaults.set(false);
      if (device) this.load(device.id);
    });
  }

  private load(deviceId: number): void {
    this.loading.set(true);
    this.api.listAll({ device_id: deviceId, status: VISIBLE_STATUSES }).subscribe({
      next: (tags) => {
        this.tags.set(tags);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(err, 'Unable to load the tags.');
      },
    });
  }

  protected toggleDefaults(): void {
    this.showDefaults.update((shown) => !shown);
    if (this.showDefaults() && !this.metadata()) {
      this.api.metadata().subscribe({
        next: (m) => this.metadata.set(m),
        error: (err) => this.toast.error(err, 'Unable to load the default tags.'),
      });
    }
  }

  protected onDefaultsAdded(): void {
    const device = this.device();
    if (device) this.load(device.id);
  }

  protected edit(tag: Tag): void {
    this.draft = this.draftOf(tag);
    this.editingId.set(tag.id);
  }

  protected save(tag: Tag): void {
    const body: TagUpdate = {
      display_name: this.draft.display_name.trim() || null,
      unit: this.draft.unit.trim() || null,
      category: this.draft.category.trim() || null,
      data_type: this.draft.data_type.trim() || null,
      is_counter: this.draft.is_counter,
      is_cumulative: this.draft.is_cumulative,
    };
    this.saving.set(true);
    this.api.update(tag.id, body).subscribe({
      next: (updated) => {
        this.replace(updated);
        this.editingId.set(null);
        this.saving.set(false);
        this.toast.success(`Tag "${tag.tag_name}" updated.`);
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  protected toggle(tag: Tag): void {
    const status = toggledStatus(tag.status);
    this.api.update(tag.id, { status }).subscribe({
      next: (updated) => {
        this.replace(updated);
        this.toast.success(
          status === 'active'
            ? `Tag "${tag.tag_name}" activated.`
            : `Tag "${tag.tag_name}" deactivated: its telemetry is no longer stored.`,
        );
      },
      error: noop, // the error toast comes from errorToastInterceptor
    });
  }

  private replace(tag: Tag): void {
    this.tags.update((list) => list.map((t) => (t.id === tag.id ? tag : t)));
  }

  private draftOf(tag: Tag | null): TagDraft {
    return {
      display_name: tag?.display_name ?? '',
      unit: tag?.unit ?? '',
      category: tag?.category ?? '',
      data_type: tag?.data_type ?? '',
      is_counter: tag?.is_counter ?? false,
      is_cumulative: tag?.is_cumulative ?? false,
    };
  }
}
