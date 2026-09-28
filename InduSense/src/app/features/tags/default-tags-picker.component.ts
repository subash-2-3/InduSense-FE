import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TagsApi } from '../../core/api/resources/tags.api';
import { DefaultTagItem, TagMetadata, TagType, TagsFromDefinitionsResult } from '../../core/models';
import { ButtonComponent } from '../../shared/ui';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { definitionsOf } from './tag-rules';

interface Choice {
  selected: boolean;
  tagName: string;
  register: string;
}

/**
 * Pick default tags (EMS or OEE, from the catalog) to create on one device. Only the ticked ones
 * are created; codes the device already has are shown as added and cannot be picked again.
 */
@Component({
  selector: 'app-default-tags-picker',
  imports: [FormsModule, ButtonComponent],
  template: `
    <div class="picker">
      <div class="types" role="radiogroup" aria-label="Tag type">
        @for (t of metadata()?.tag_types ?? []; track t.value) {
          <button
            type="button"
            role="radio"
            class="types__item"
            [class.types__item--active]="type() === t.value"
            [attr.aria-checked]="type() === t.value"
            (click)="type.set(t.value)"
          >
            {{ t.label }}
          </button>
        }
      </div>

      @if (definitions().length === 0) {
        <p class="muted">No default tags of this type.</p>
      } @else {
        <table class="list">
          <thead>
            <tr>
              <th scope="col"><span class="sr-only">Add</span></th>
              <th scope="col">Default tag</th>
              <th scope="col">Unit</th>
              <th scope="col">Decimals</th>
              <th scope="col">Tag name at the source</th>
              <th scope="col">Register / address</th>
            </tr>
          </thead>
          <tbody>
            @for (d of definitions(); track d.code) {
              @let added = existing().has(d.code);
              <tr [class.added]="added">
                <td>
                  <input
                    type="checkbox"
                    [attr.aria-label]="'Add ' + d.display_name"
                    [disabled]="added"
                    [checked]="choice(d.code).selected"
                    (change)="toggle(d.code)"
                  />
                </td>
                <td>
                  <strong>{{ d.display_name }}</strong>
                  <div class="muted mono">{{ d.code }}{{ added ? ' · already added' : '' }}</div>
                </td>
                <td>{{ d.unit ?? '—' }}</td>
                <td>{{ d.roundoff_digits ?? '—' }}</td>
                <td>
                  <input
                    class="field"
                    [attr.aria-label]="'Tag name for ' + d.display_name"
                    [placeholder]="d.code"
                    [disabled]="added || !choice(d.code).selected"
                    [ngModel]="choice(d.code).tagName"
                    (ngModelChange)="set(d.code, 'tagName', $event)"
                  />
                </td>
                <td>
                  <input
                    class="field"
                    [attr.aria-label]="'Register for ' + d.display_name"
                    placeholder="optional"
                    [disabled]="added || !choice(d.code).selected"
                    [ngModel]="choice(d.code).register"
                    (ngModelChange)="set(d.code, 'register', $event)"
                  />
                </td>
              </tr>
            }
          </tbody>
        </table>
      }

      <div class="actions">
        <span class="muted">{{ selectedCount() }} selected</span>
        <button
          appButton
          variant="primary"
          type="button"
          [disabled]="!deviceId() || selectedCount() === 0 || saving()"
          [loading]="saving()"
          (click)="add()"
        >
          Add selected tags
        </button>
      </div>
    </div>
  `,
  styles: `
    .picker {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .types {
      display: inline-flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .types__item {
      padding: 6px 12px;
      border: 1px solid var(--border-light);
      border-radius: var(--radius-pill);
      background: var(--bg-topbar);
      color: var(--text-secondary);
      font-size: var(--fs-sm);
      cursor: pointer;
    }
    .types__item--active {
      border-color: var(--accent-cyan);
      background: var(--accent-cyan-soft);
      color: var(--accent-cyan);
      font-weight: var(--fw-semibold);
    }
    .types__item:focus-visible {
      outline: 2px solid var(--accent-cyan);
      outline-offset: 1px;
    }
    .list {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--fs-sm);
      text-align: left;
    }
    .list th,
    .list td {
      padding: var(--space-2);
      border-bottom: 1px solid var(--border-card);
      vertical-align: middle;
    }
    .list th {
      color: var(--text-secondary);
      font-size: var(--fs-xs);
      text-transform: uppercase;
    }
    .added {
      opacity: 0.6;
    }
    .field {
      width: 100%;
      min-width: 110px;
      height: 30px;
      padding: 0 var(--space-2);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      background: var(--bg-card);
      color: var(--text-primary);
      font-size: var(--fs-sm);
    }
    .field:disabled {
      opacity: 0.5;
    }
    .muted {
      color: var(--text-muted);
      font-size: var(--fs-xs);
    }
    .mono {
      font-family: var(--font-mono);
    }
    .actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-3);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DefaultTagsPickerComponent {
  private readonly api = inject(TagsApi);
  private readonly toast = inject(ToastService);

  readonly deviceId = input<number | null>(null);
  readonly metadata = input<TagMetadata | null>(null);
  /** Codes the device already has (shown as added). */
  readonly existingCodes = input<readonly (string | null)[]>([]);
  readonly added = output<TagsFromDefinitionsResult>();

  protected readonly type = linkedSignal<TagType | null>(
    () => this.metadata()?.tag_types[0]?.value ?? null,
  );
  protected readonly definitions = computed(() => definitionsOf(this.metadata(), this.type()));
  protected readonly existing = computed(
    () => new Set(this.existingCodes().filter((c): c is string => !!c)),
  );
  protected readonly saving = signal(false);
  private readonly choices = signal<Record<string, Choice>>({});

  protected readonly selectedCount = computed(
    () =>
      Object.entries(this.choices()).filter(([code, c]) => c.selected && !this.existing().has(code))
        .length,
  );

  protected choice(code: string): Choice {
    return this.choices()[code] ?? { selected: false, tagName: '', register: '' };
  }

  protected toggle(code: string): void {
    this.set(code, 'selected', !this.choice(code).selected);
  }

  protected set<K extends keyof Choice>(code: string, key: K, value: Choice[K]): void {
    this.choices.update((all) => ({ ...all, [code]: { ...this.choice(code), [key]: value } }));
  }

  protected add(): void {
    const deviceId = this.deviceId();
    if (!deviceId) {
      return;
    }
    const items: DefaultTagItem[] = Object.entries(this.choices())
      .filter(([code, c]) => c.selected && !this.existing().has(code))
      .map(([code, c]) => ({
        code,
        tag_name: c.tagName.trim() || null,
        register_address: c.register.trim() || null,
      }));
    this.saving.set(true);
    this.api.createFromDefinitions(deviceId, items).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.choices.set({});
        const done = result.created.length + result.restored.length;
        const skipped = result.skipped.map((s) => `${s.code}: ${s.reason}`).join('; ');
        this.toast.success(
          `${done} default tag${done === 1 ? '' : 's'} added.` +
            (skipped ? ` Skipped — ${skipped}` : ''),
        );
        this.added.emit(result);
      },
      error: () => this.saving.set(false), // the error toast comes from errorToastInterceptor
    });
  }
}
