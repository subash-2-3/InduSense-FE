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

import { ApiError } from '../../core/api/api-error';
import { TagsApi } from '../../core/api/resources/tags.api';
import {
  Device,
  EditableStatus,
  Tag,
  TagCreate,
  TagDefinition,
  TagMetadata,
  TagType,
  TagUpdate,
} from '../../core/models';
import { ButtonComponent, ModalComponent } from '../../shared/ui';
import { ToastService } from '../../shared/ui/toast/toast.service';
import {
  DATA_TYPE_SUGGESTIONS,
  TAG_CODE_PATTERN,
  definitionsOf,
  formatStateMap,
  parseStateMap,
  roundoffError,
  roundoffValue,
} from './tag-rules';

export interface TagForm {
  device_id: number | null;
  tag_type: TagType;
  tag_name: string;
  code: string;
  display_name: string;
  data_type: string;
  unit: string;
  roundoff: string;
  description: string;
  is_counter: boolean;
  is_cumulative: boolean;
  status: EditableStatus;
  /** `0=RUNNING, 1=IDLE, 2=ALARM`; empty = non-zero is running. */
  state_map: string;
}

export function emptyForm(type: TagType, deviceId: number | null = null): TagForm {
  return {
    device_id: deviceId,
    tag_type: type,
    tag_name: '',
    code: '',
    display_name: '',
    data_type: '',
    unit: '',
    roundoff: '',
    description: '',
    is_counter: false,
    is_cumulative: false,
    status: 'active',
    state_map: '',
  };
}

export function formOf(tag: Tag): TagForm {
  return {
    device_id: tag.device_id,
    tag_type: tag.tag_type,
    tag_name: tag.tag_name,
    code: tag.code ?? '',
    display_name: tag.display_name ?? '',
    data_type: tag.data_type ?? '',
    unit: tag.unit ?? '',
    roundoff: tag.roundoff_digits === null ? '' : String(tag.roundoff_digits),
    description: tag.description ?? '',
    is_counter: tag.is_counter,
    is_cumulative: tag.is_cumulative,
    status: tag.status === 'inactive' ? 'inactive' : 'active',
    state_map: formatStateMap(tag.state_map),
  };
}

/** Copies a default definition's metadata into the form (the tag name stays the user's). */
export function applyDefinition(form: TagForm, d: TagDefinition): TagForm {
  return {
    ...form,
    tag_type: d.tag_type,
    code: d.code,
    tag_name: form.tag_name || d.code,
    display_name: d.display_name,
    unit: d.unit ?? '',
    roundoff: d.roundoff_digits === null ? '' : String(d.roundoff_digits),
    description: d.description ?? '',
    is_counter: d.is_counter,
    is_cumulative: d.is_cumulative,
  };
}

const text = (value: string) => value.trim() || null;

/** Create or edit one tag. Generic tag fields only; protocol metadata stays with the DataLogger. */
@Component({
  selector: 'app-tag-form-dialog',
  imports: [FormsModule, ButtonComponent, ModalComponent],
  template: `
    <app-modal
      [open]="open()"
      [title]="tag() ? 'Edit tag ' + tag()!.tag_name : 'New tag'"
      subtitle="EMS and OEE tags share the same telemetry pipeline"
      maxWidth="720px"
      (close)="closed.emit()"
    >
      <form class="form" (ngSubmit)="save()" novalidate>
        <fieldset class="group">
          <legend>Basic information</legend>
          <label class="f">
            <span>Device *</span>
            <select name="device" [(ngModel)]="form.device_id" [disabled]="!!tag()" required>
              <option [ngValue]="null" disabled>Choose a device</option>
              @for (d of devices(); track d.id) {
                <option [ngValue]="d.id">{{ d.name || d.external_id }}</option>
              }
            </select>
          </label>
          <label class="f">
            <span>Tag type *</span>
            <select name="tag_type" [ngModel]="form.tag_type" (ngModelChange)="setType($event)">
              @for (t of metadata()?.tag_types ?? []; track t.value) {
                <option [ngValue]="t.value">{{ t.label }}</option>
              }
            </select>
          </label>
          @if (!tag()) {
            <label class="f f--wide">
              <span>Start from a default {{ typeShort() }} tag</span>
              <select name="definition" [ngModel]="null" (ngModelChange)="useDefinition($event)">
                <option [ngValue]="null">— none (custom tag) —</option>
                @for (d of suggestions(); track d.code) {
                  <option [ngValue]="d">{{ d.display_name }} ({{ d.code }})</option>
                }
              </select>
            </label>
          }
          <label class="f">
            <span>Tag name *</span>
            <input
              name="tag_name"
              [(ngModel)]="form.tag_name"
              [readonly]="!!tag()"
              maxlength="150"
              placeholder="Name used by the data source"
            />
            @if (tag()) {
              <small>The data source's key; it cannot be changed.</small>
            }
          </label>
          <label class="f">
            <span>Tag code</span>
            <input name="code" [(ngModel)]="form.code" maxlength="64" placeholder="e.g. voltage" />
            @if (errors().code; as e) {
              <small class="err" role="alert">{{ e }}</small>
            }
          </label>
          <label class="f">
            <span>Display name</span>
            <input name="display_name" [(ngModel)]="form.display_name" maxlength="200" />
          </label>
          <label class="f">
            <span>Data type</span>
            <input
              name="data_type"
              [(ngModel)]="form.data_type"
              maxlength="32"
              list="tag-data-types"
              placeholder="connection default"
            />
            <datalist id="tag-data-types">
              @for (t of dataTypes; track t) {
                <option [value]="t"></option>
              }
            </datalist>
          </label>
          <label class="f">
            <span>Unit</span>
            <input name="unit" [(ngModel)]="form.unit" maxlength="32" />
          </label>
          <label class="f">
            <span>Status</span>
            <select name="status" [(ngModel)]="form.status">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label class="f f--wide">
            <span>Description</span>
            <textarea
              name="description"
              rows="2"
              maxlength="500"
              [(ngModel)]="form.description"
            ></textarea>
          </label>
          <div class="f f--wide checks">
            <label
              ><input type="checkbox" name="is_counter" [(ngModel)]="form.is_counter" />
              Counter</label
            >
            <label
              ><input type="checkbox" name="is_cumulative" [(ngModel)]="form.is_cumulative" />
              Cumulative</label
            >
          </div>
        </fieldset>

        <fieldset class="group">
          <legend>Display</legend>
          <label class="f">
            <span>Round-off digits</span>
            <input
              name="roundoff"
              type="number"
              min="0"
              [max]="max()"
              step="1"
              [(ngModel)]="form.roundoff"
              placeholder="as stored"
            />
            @if (errors().roundoff; as e) {
              <small class="err" role="alert">{{ e }}</small>
            } @else {
              <small
                >Decimals shown for float values (0–{{ max() }}). Stored telemetry is never
                rounded.</small
              >
            }
          </label>
        </fieldset>

        @if (form.tag_type === 'oee' || form.state_map) {
          <fieldset class="group">
            <legend>Machine state</legend>
            <label class="f f--wide">
              <span>State map (machine status tags)</span>
              <input
                name="state_map"
                [(ngModel)]="form.state_map"
                maxlength="400"
                placeholder="e.g. 0=RUNNING, 1=IDLE, 2=ALARM"
              />
              @if (errors().state_map; as e) {
                <small class="err" role="alert">{{ e }}</small>
              } @else {
                <small>
                  Which value means which state ({{ states().join(', ') }}); only RUNNING counts as
                  runtime. Empty: any non-zero value is running.
                </small>
              }
            </label>
          </fieldset>
        }

        @if (serverError(); as e) {
          <p class="err" role="alert">{{ e }}</p>
        }
        <div class="actions">
          <button appButton variant="ghost" type="button" (click)="closed.emit()">Cancel</button>
          <button
            appButton
            variant="primary"
            type="submit"
            [disabled]="!canSave()"
            [loading]="saving()"
          >
            {{ tag() ? 'Save changes' : 'Create tag' }}
          </button>
        </div>
      </form>
    </app-modal>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    .group {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      border: 0;
    }
    .group legend {
      margin-bottom: var(--space-2);
      font-size: var(--fs-xs);
      font-weight: var(--fw-semibold);
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .f {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      font-size: var(--fs-sm);
      color: var(--text-secondary);
    }
    .f--wide {
      grid-column: 1 / -1;
    }
    .f input,
    .f select,
    .f textarea {
      min-height: 34px;
      padding: 6px 10px;
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      background: var(--bg-topbar);
      color: var(--text-primary);
      font: inherit;
    }
    .f input:focus-visible,
    .f select:focus-visible,
    .f textarea:focus-visible {
      outline: 2px solid var(--accent-cyan);
      outline-offset: 1px;
    }
    .f input[readonly],
    .f select:disabled {
      opacity: 0.7;
    }
    .f small {
      color: var(--text-muted);
      font-size: var(--fs-xs);
    }
    .checks {
      flex-direction: row;
      gap: var(--space-4);
    }
    .err,
    .f small.err {
      color: var(--status-fault-text);
      margin: 0;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagFormDialogComponent {
  private readonly api = inject(TagsApi);
  private readonly toast = inject(ToastService);

  readonly open = input(false);
  /** The tag being edited; null = create. */
  readonly tag = input<Tag | null>(null);
  readonly devices = input<readonly Device[]>([]);
  readonly metadata = input<TagMetadata | null>(null);
  /** Preselected device when creating. */
  readonly deviceId = input<number | null>(null);
  readonly saved = output<Tag>();
  readonly closed = output<void>();

  protected readonly dataTypes = DATA_TYPE_SUGGESTIONS;
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly max = computed(() => this.metadata()?.roundoff_max ?? 6);
  protected readonly states = computed(
    () => this.metadata()?.machine_states ?? ['RUNNING', 'IDLE', 'STOPPED', 'ALARM'],
  );
  /** Bumped on every edit so the computed checks below re-run (the form is a plain object). */
  private readonly revision = signal(0);
  protected form: TagForm = emptyForm('ems');

  protected readonly suggestions = computed(() => {
    this.revision();
    return definitionsOf(this.metadata(), this.form.tag_type);
  });
  protected readonly typeShort = computed(() => {
    this.revision();
    return this.form.tag_type.toUpperCase();
  });

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }
      const tag = this.tag();
      const firstType = this.metadata()?.tag_types[0]?.value ?? 'ems';
      this.form = tag ? formOf(tag) : emptyForm(firstType, this.deviceId());
      this.serverError.set(null);
      this.revision.update((n) => n + 1);
    });
  }

  protected errors(): { code?: string; roundoff?: string; state_map?: string } {
    const result: { code?: string; roundoff?: string; state_map?: string } = {};
    const stateMap = parseStateMap(this.form.state_map, this.states()).error;
    if (stateMap) {
      result.state_map = stateMap;
    }
    const code = this.form.code.trim();
    if (code && !TAG_CODE_PATTERN.test(code)) {
      result.code = 'Lowercase letters, digits, "_", "." or "-" (e.g. voltage).';
    }
    const roundoff = roundoffError(this.form.roundoff, this.form.data_type, this.max());
    if (roundoff) {
      result.roundoff = roundoff;
    }
    return result;
  }

  protected canSave(): boolean {
    const e = this.errors();
    return (
      !this.saving() &&
      !!this.form.device_id &&
      !!this.form.tag_name.trim() &&
      !e.code &&
      !e.roundoff &&
      !e.state_map
    );
  }

  protected setType(type: TagType): void {
    this.form = { ...this.form, tag_type: type };
    this.revision.update((n) => n + 1);
  }

  protected useDefinition(d: TagDefinition | null): void {
    if (d) {
      this.form = applyDefinition(this.form, d);
      this.revision.update((n) => n + 1);
    }
  }

  protected save(): void {
    if (!this.canSave()) {
      return;
    }
    const f = this.form;
    const shared = {
      code: text(f.code),
      display_name: text(f.display_name),
      tag_type: f.tag_type,
      data_type: text(f.data_type),
      unit: text(f.unit),
      roundoff_digits: roundoffValue(f.roundoff),
      description: text(f.description),
      state_map: parseStateMap(f.state_map, this.states()).map,
      is_counter: f.is_counter,
      is_cumulative: f.is_cumulative,
      status: f.status,
    };
    const tag = this.tag();
    const request = tag
      ? this.api.update(tag.id, shared satisfies TagUpdate)
      : this.api.create({
          ...shared,
          device_id: f.device_id!,
          tag_name: f.tag_name.trim(),
        } satisfies TagCreate);
    this.saving.set(true);
    this.serverError.set(null);
    request.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.toast.success(
          tag ? `Tag "${saved.tag_name}" updated.` : `Tag "${saved.tag_name}" created.`,
        );
        this.saved.emit(saved);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        // The toast comes from errorToastInterceptor; keep the reason next to the form too.
        this.serverError.set(ApiError.from(err).message);
      },
    });
  }
}
