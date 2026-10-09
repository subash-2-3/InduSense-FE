import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, noop } from 'rxjs';

import { ApiError } from '../../core/api/api-error';
import { DevicesApi } from '../../core/api/resources/devices.api';
import { TagsApi } from '../../core/api/resources/tags.api';
import { AuthService } from '../../core/auth/auth.service';
import { Permission } from '../../core/auth/permissions';
import { Device, RecordStatus, Tag, TagFilters, TagMetadata, TagType } from '../../core/models';
import {
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  IconComponent,
  ModalComponent,
  SearchableSelectComponent,
  SelectOption,
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
import { persistedSignal } from '../../shared/utils/session-draft';
import { DefaultTagsPickerComponent } from './default-tags-picker.component';
import { TagFormDialogComponent } from './tag-form-dialog.component';
import { tagTypeLabel } from './tag-rules';

export const TAGS_PAGE_SIZE = 25;

type StatusChoice = 'visible' | RecordStatus;

/** Tags of every device in the company: EMS/OEE classification, display round-off, CRUD. */
@Component({
  selector: 'app-tags-page',
  imports: [
    FormsModule,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    IconComponent,
    ModalComponent,
    SearchableSelectComponent,
    SkeletonComponent,
    StatusPillComponent,
    DefaultTagsPickerComponent,
    TagFormDialogComponent,
  ],
  template: `
    <div class="page">
      <header class="head">
        <div>
          <h1 class="title">Tags</h1>
          <p class="subtitle">
            Device signals classified for energy management (EMS) and equipment effectiveness (OEE)
          </p>
        </div>
        <div class="head__actions">
          @if (canCreate()) {
            <button appButton variant="secondary" type="button" (click)="openDefaults()">
              <app-icon name="package" [size]="14" /> Add default tags
            </button>
            <button appButton variant="primary" type="button" (click)="openCreate()">
              <app-icon name="plus" [size]="14" /> New tag
            </button>
          }
        </div>
      </header>

      <app-card>
        <div class="filters" role="group" aria-label="Tag filters">
          <label class="fl fl--grow">
            <span>Search</span>
            <input
              type="search"
              placeholder="Tag name, display name or code"
              [ngModel]="search()"
              (ngModelChange)="onSearch($event)"
            />
          </label>
          <label class="fl">
            <span>Tag type</span>
            <app-searchable-select
              ariaLabel="Tag type"
              placeholder="All types"
              clearable
              [options]="typeFilterOptions()"
              [ngModel]="type()"
              (ngModelChange)="setFilter(type, $event)"
            />
          </label>
          <label class="fl">
            <span>Device</span>
            <app-searchable-select
              ariaLabel="Device"
              placeholder="All devices"
              clearable
              [options]="deviceFilterOptions()"
              [ngModel]="deviceId()"
              (ngModelChange)="setFilter(deviceId, $event)"
            />
          </label>
          <label class="fl">
            <span>Status</span>
            <app-searchable-select
              ariaLabel="Status"
              [options]="statusFilterOptions()"
              [ngModel]="status()"
              (ngModelChange)="setFilter(status, $event)"
            />
          </label>
        </div>
      </app-card>

      <app-card [padded]="false">
        @if (error(); as e) {
          <div class="pad">
            <app-error-state heading="Tags unavailable" [message]="e" (retry)="load()" />
          </div>
        } @else if (loading() && !tags().length) {
          <div class="pad"><app-skeleton height="200px" /></div>
        } @else if (!tags().length) {
          <div class="pad">
            <app-empty-state
              heading="No tags"
              message="No tags match these filters. Tags also appear when the DataLogger first reports a value."
            />
          </div>
        } @else {
          <div class="wrap">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col">Tag</th>
                  <th scope="col">Code</th>
                  <th scope="col">Device</th>
                  <th scope="col">Type</th>
                  <th scope="col">Data type</th>
                  <th scope="col">Unit</th>
                  <th scope="col" class="num">Decimals</th>
                  <th scope="col">Status</th>
                  <th scope="col" class="num">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (t of tags(); track t.id) {
                  <tr>
                    <td>
                      <strong>{{ t.display_name || t.tag_name }}</strong>
                      <div class="mono muted">{{ t.tag_name }}</div>
                    </td>
                    <td class="mono">{{ t.code ?? '—' }}</td>
                    <td>{{ deviceName(t.device_id) }}</td>
                    <td>
                      <span class="badge" [class.badge--oee]="t.tag_type === 'oee'">{{
                        typeLabel(t.tag_type)
                      }}</span>
                    </td>
                    <td class="mono">{{ t.data_type ?? 'default' }}</td>
                    <td>{{ t.unit ?? '—' }}</td>
                    <td class="num">{{ t.roundoff_digits ?? '—' }}</td>
                    <td>
                      <app-status-pill
                        [label]="statusLabel(t.status)"
                        [tone]="statusTone(t.status)"
                      />
                    </td>
                    <td class="num">
                      @if (t.status === 'delete') {
                        @if (canUpdate()) {
                          <button
                            appButton
                            variant="ghost"
                            size="sm"
                            type="button"
                            (click)="restore(t)"
                          >
                            Restore
                          </button>
                        }
                      } @else {
                        @if (canUpdate()) {
                          <button
                            appButton
                            variant="ghost"
                            size="sm"
                            type="button"
                            [attr.aria-label]="'Edit tag ' + t.tag_name"
                            (click)="openEdit(t)"
                          >
                            <app-icon name="edit" [size]="14" />
                          </button>
                          <button
                            appButton
                            variant="ghost"
                            size="sm"
                            type="button"
                            (click)="toggle(t)"
                          >
                            {{ t.status === 'active' ? 'Deactivate' : 'Activate' }}
                          </button>
                        }
                        @if (canDelete()) {
                          <button
                            appButton
                            variant="ghost"
                            size="sm"
                            type="button"
                            [attr.aria-label]="'Delete tag ' + t.tag_name"
                            (click)="remove(t)"
                          >
                            Delete
                          </button>
                        }
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="pager">
            <span>{{ total() }} tags · page {{ page() }} of {{ totalPages() }}</span>
            <div class="pager__buttons">
              <button
                appButton
                variant="secondary"
                size="sm"
                type="button"
                [disabled]="page() <= 1 || loading()"
                (click)="setPage(page() - 1)"
              >
                <app-icon name="chevron-left" [size]="14" /> Previous
              </button>
              <button
                appButton
                variant="secondary"
                size="sm"
                type="button"
                [disabled]="page() >= totalPages() || loading()"
                (click)="setPage(page() + 1)"
              >
                Next <app-icon name="chevron-right" [size]="14" />
              </button>
            </div>
          </div>
        }
      </app-card>
    </div>

    <app-tag-form-dialog
      [open]="formOpen()"
      [tag]="editing()"
      [devices]="activeDevices()"
      [metadata]="metadata()"
      [deviceId]="deviceId()"
      (saved)="onSaved()"
      (closed)="formOpen.set(false)"
    />

    <app-modal
      [open]="defaultsOpen()"
      title="Add default tags"
      subtitle="Pick the EMS or OEE tags this device provides; only the ticked ones are created"
      maxWidth="900px"
      (close)="defaultsOpen.set(false)"
    >
      <label class="fl fl--device">
        <span>Device</span>
        <app-searchable-select
          ariaLabel="Device"
          placeholder="Choose a device"
          [options]="activeDeviceOptions()"
          [ngModel]="defaultsDevice()"
          (ngModelChange)="chooseDefaultsDevice($event)"
        />
      </label>
      @if (defaultsDevice()) {
        <app-default-tags-picker
          [deviceId]="defaultsDevice()"
          [metadata]="metadata()"
          [existingCodes]="deviceCodes()"
          (added)="onDefaultsAdded()"
        />
      }
    </app-modal>
  `,
  styleUrl: './tags-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagsPageComponent implements OnInit {
  private readonly tagsApi = inject(TagsApi);
  private readonly devicesApi = inject(DevicesApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly canCreate = computed(() => this.auth.hasPermission(Permission.TagsCreate));
  protected readonly canUpdate = computed(() => this.auth.hasPermission(Permission.TagsUpdate));
  protected readonly canDelete = computed(() => this.auth.hasPermission(Permission.TagsDelete));
  protected readonly statusLabel = recordStatusLabel;
  protected readonly statusTone = recordStatusTone;

  protected readonly metadata = signal<TagMetadata | null>(null);
  protected readonly devices = signal<Device[]>([]);
  protected readonly activeDevices = computed(() =>
    this.devices().filter((d) => d.status === 'active'),
  );
  protected readonly deviceFilterOptions = computed<SelectOption[]>(() =>
    this.devices().map((d) => ({ value: d.id, label: d.name || d.external_id })),
  );
  protected readonly activeDeviceOptions = computed<SelectOption[]>(() =>
    this.activeDevices().map((d) => ({ value: d.id, label: d.name || d.external_id })),
  );
  protected readonly typeFilterOptions = computed<SelectOption[]>(() =>
    (this.metadata()?.tag_types ?? []).map((t) => ({ value: t.value, label: t.label })),
  );
  protected readonly statusFilterOptions = computed<SelectOption[]>(() => {
    const options: SelectOption[] = [
      { value: 'visible', label: 'Active & inactive' },
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ];
    if (this.canUpdate()) {
      options.push({ value: 'delete', label: 'Deleted' });
    }
    return options;
  });
  protected readonly tags = signal<Tag[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly total = signal(0);
  protected readonly totalPages = signal(1);
  protected readonly page = signal(1);

  protected readonly search = signal('');
  protected readonly type = signal<TagType | null>(null);
  protected readonly deviceId = signal<number | null>(null);
  protected readonly status = signal<StatusChoice>('visible');

  // Persisted so a half-filled "New tag" drawer reopens when the user returns to this menu.
  protected readonly formOpen = persistedSignal('indusense.tags.creating', false);
  protected readonly editing = signal<Tag | null>(null);
  protected readonly defaultsOpen = signal(false);
  protected readonly defaultsDevice = signal<number | null>(null);
  protected readonly deviceCodes = signal<(string | null)[]>([]);

  private readonly search$ = new Subject<string>();
  private readonly deviceNames = computed(
    () => new Map(this.devices().map((d) => [d.id, d.name || d.external_id])),
  );

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.setPage(1));
    this.tagsApi.metadata().subscribe({
      next: (m) => this.metadata.set(m),
      error: (e) => this.toast.error(e, 'Unable to load the tag types.'),
    });
    this.devicesApi.listAll({ status: VISIBLE_STATUSES }).subscribe({
      next: (d) => this.devices.set(d),
      error: noop, // device names then show as ids
    });
    this.load();
  }

  protected filters(): TagFilters {
    const status = this.status();
    return {
      search: this.search().trim() || undefined,
      tag_type: this.type() ?? undefined,
      device_id: this.deviceId() ?? undefined,
      status: status === 'visible' ? VISIBLE_STATUSES : status,
    };
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.tagsApi
      .list({ ...this.filters(), page: this.page(), page_size: TAGS_PAGE_SIZE })
      .subscribe({
        next: (result) => {
          this.tags.set(result.items);
          this.total.set(result.pagination.total);
          this.totalPages.set(result.pagination.total_pages || 1);
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(ApiError.from(e).message);
          this.loading.set(false);
        },
      });
  }

  protected setPage(page: number): void {
    this.page.set(Math.max(1, page));
    this.load();
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    this.search$.next(value);
  }

  protected setFilter<T>(target: { set(value: T): void }, value: T): void {
    target.set(value);
    this.setPage(1);
  }

  protected typeLabel(type: TagType): string {
    return tagTypeLabel(this.metadata()?.tag_types ?? [], type);
  }

  protected deviceName(id: number): string {
    return this.deviceNames().get(id) ?? `#${id}`;
  }

  // ------------------------------------------------------------------- actions ----

  protected openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(tag: Tag): void {
    this.editing.set(tag);
    this.formOpen.set(true);
  }

  protected onSaved(): void {
    this.formOpen.set(false);
    this.load();
  }

  protected toggle(tag: Tag): void {
    const status = toggledStatus(tag.status);
    this.tagsApi.update(tag.id, { status }).subscribe({
      next: () => {
        this.toast.success(
          status === 'active'
            ? `Tag "${tag.tag_name}" activated.`
            : `Tag "${tag.tag_name}" deactivated: its telemetry is no longer stored.`,
        );
        this.load();
      },
      error: noop, // the error toast comes from errorToastInterceptor
    });
  }

  protected remove(tag: Tag): void {
    if (
      !confirm(
        `Delete tag "${tag.tag_name}"? The DataLogger stops storing it; its history is kept.`,
      )
    ) {
      return;
    }
    this.tagsApi.delete(tag.id).subscribe({
      next: () => {
        this.toast.success(`Tag "${tag.tag_name}" deleted.`);
        this.load();
      },
      error: noop,
    });
  }

  protected restore(tag: Tag): void {
    this.tagsApi.update(tag.id, { status: 'active' }).subscribe({
      next: () => {
        this.toast.success(`Tag "${tag.tag_name}" restored.`);
        this.load();
      },
      error: noop,
    });
  }

  protected openDefaults(): void {
    this.defaultsOpen.set(true);
    this.chooseDefaultsDevice(this.deviceId());
  }

  protected chooseDefaultsDevice(id: number | null): void {
    this.defaultsDevice.set(id);
    this.deviceCodes.set([]);
    if (id) {
      this.tagsApi.listAll({ device_id: id, status: ['active', 'inactive'] }).subscribe({
        next: (tags) => this.deviceCodes.set(tags.map((t) => t.code)),
        error: noop,
      });
    }
  }

  protected onDefaultsAdded(): void {
    this.chooseDefaultsDevice(this.defaultsDevice());
    this.load();
  }
}
