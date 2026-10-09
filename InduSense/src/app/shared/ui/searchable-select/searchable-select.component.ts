import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  HostListener,
  booleanAttribute,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { IconComponent } from '../icon/icon.component';

export interface SelectOption {
  value: unknown;
  label: string;
  disabled?: boolean;
}

/**
 * A select with a built-in search box and a check beside the chosen row — the image-2 dropdown.
 *
 * It is a `ControlValueAccessor`, so it drops straight into `[(ngModel)]` (and reactive forms) in
 * place of a native `<select>`, and it preserves the option's value type (number, string or null).
 * Keyboard: type to filter, Up/Down to move, Enter to choose, Escape to close. It closes on a
 * pointer-down outside itself; the dropdown renders inline so it stays inside an open drawer.
 */
@Component({
  selector: 'app-searchable-select',
  imports: [IconComponent],
  template: `
    <div class="ss" [class.ss--invalid]="invalid()">
      <button
        #trigger
        type="button"
        class="ss__trigger"
        [id]="id()"
        [disabled]="disabled()"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-expanded]="open()"
        [attr.aria-invalid]="invalid() || null"
        aria-haspopup="listbox"
        (click)="toggle()"
        (keydown)="onTriggerKey($event)"
      >
        <span class="ss__value" [class.ss__value--placeholder]="!selected()">
          {{ selected()?.label ?? placeholder() }}
        </span>
        <app-icon name="chevron-down" [size]="16" class="ss__chevron" />
      </button>

      @if (open()) {
        <div class="ss__panel">
          @if (showSearch()) {
            <div class="ss__search">
              <app-icon name="search" [size]="15" class="ss__search-icon" />
              <input
                #search
                class="ss__search-input"
                [value]="query()"
                (input)="query.set($any($event.target).value)"
                (keydown)="onSearchKey($event)"
                [attr.aria-label]="'Search ' + (ariaLabel() || 'options')"
                placeholder="Search..."
                autocomplete="off"
              />
              @if (query()) {
                <button type="button" class="ss__clear" aria-label="Clear search" (click)="query.set('')">
                  <app-icon name="x" [size]="14" />
                </button>
              }
            </div>
          }
          <ul class="ss__list" role="listbox" [attr.aria-label]="ariaLabel()">
            @if (clearable()) {
              <li>
                <button
                  type="button"
                  role="option"
                  class="ss__option ss__option--muted"
                  [class.ss__option--active]="active() === -1"
                  [attr.aria-selected]="!selected()"
                  (click)="choose(null)"
                  (mouseenter)="active.set(-1)"
                >
                  <span class="ss__option-label">{{ placeholder() }}</span>
                  @if (!selected()) {
                    <app-icon name="check" [size]="16" class="ss__check" />
                  }
                </button>
              </li>
            }
            @for (opt of visible(); track $index) {
              <li>
                <button
                  type="button"
                  role="option"
                  class="ss__option"
                  [class.ss__option--active]="active() === $index"
                  [class.ss__option--selected]="isSelected(opt)"
                  [disabled]="opt.disabled"
                  [attr.aria-selected]="isSelected(opt)"
                  (click)="choose(opt)"
                  (mouseenter)="active.set($index)"
                >
                  <span class="ss__option-label">{{ opt.label }}</span>
                  @if (isSelected(opt)) {
                    <app-icon name="check" [size]="16" class="ss__check" />
                  }
                </button>
              </li>
            }
            @if (visible().length === 0) {
              <li class="ss__empty">{{ emptyLabel() }}</li>
            }
          </ul>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .ss {
      position: relative;
    }
    .ss__trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      width: 100%;
      min-height: 34px;
      padding: 6px 10px;
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      background: var(--bg-topbar);
      color: var(--text-primary);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .ss__trigger:focus-visible {
      outline: 2px solid var(--accent-cyan);
      outline-offset: 1px;
    }
    .ss__trigger:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
    .ss--invalid .ss__trigger {
      border-color: var(--status-fault-text);
    }
    .ss__value {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ss__value--placeholder {
      color: var(--text-muted);
    }
    .ss__chevron {
      flex-shrink: 0;
      color: var(--text-muted);
    }
    .ss__panel {
      position: absolute;
      z-index: 50;
      top: calc(100% + 4px);
      left: 0;
      width: 100%;
      overflow: hidden;
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      background: var(--bg-card);
      box-shadow: 0 12px 30px -8px rgba(0, 0, 0, 0.45);
      animation: ssFadeIn 0.12s ease-out;
    }
    .ss__search {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: 6px 10px;
      border-bottom: 1px solid var(--border-light);
    }
    .ss__search-icon {
      flex-shrink: 0;
      color: var(--text-muted);
    }
    .ss__search-input {
      width: 100%;
      border: 0;
      background: transparent;
      color: var(--text-primary);
      font: inherit;
    }
    .ss__search-input:focus {
      outline: none;
    }
    .ss__clear {
      display: inline-flex;
      border: 0;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
    }
    .ss__clear:hover {
      color: var(--text-primary);
    }
    .ss__list {
      max-height: 15rem;
      overflow-y: auto;
      margin: 0;
      padding: 4px;
      list-style: none;
    }
    .ss__option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      width: 100%;
      padding: 7px 10px;
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-primary);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .ss__option--muted {
      color: var(--text-muted);
    }
    .ss__option--active {
      background: var(--bg-hover, rgba(255, 255, 255, 0.06));
    }
    .ss__option--selected {
      color: var(--accent-cyan);
      font-weight: 600;
    }
    .ss__option:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .ss__option-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ss__check {
      flex-shrink: 0;
      color: var(--accent-cyan);
    }
    .ss__empty {
      padding: 20px 10px;
      text-align: center;
      font-size: var(--fs-xs);
      color: var(--text-muted);
    }
    @keyframes ssFadeIn {
      from {
        opacity: 0;
        transform: translateY(-2px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelectComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchableSelectComponent implements ControlValueAccessor {
  readonly options = input<readonly SelectOption[]>([]);
  readonly placeholder = input('Select an option...');
  readonly id = input<string>();
  readonly ariaLabel = input<string>();
  /** Show a top row that clears the selection (for optional / filter dropdowns). */
  readonly clearable = input(false, { transform: booleanAttribute });
  /** Force the search box on/off; by default it appears once there are more than 6 options. */
  readonly searchable = input<boolean | undefined>(undefined);
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly emptyLabel = input('No matches');
  readonly disabledInput = input(false, { transform: booleanAttribute, alias: 'disabled' });

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('search');
  private readonly triggerBtn = viewChild<ElementRef<HTMLButtonElement>>('trigger');

  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly active = signal(0);
  private readonly value = signal<unknown>(null);
  private readonly cvaDisabled = signal(false);

  protected readonly disabled = computed(() => this.disabledInput() || this.cvaDisabled());

  protected readonly selected = computed(
    () => this.options().find((opt) => this.same(opt.value, this.value())) ?? null,
  );

  protected readonly showSearch = computed(() =>
    this.searchable() ?? this.options().length > 6,
  );

  protected readonly visible = computed(() => {
    const needle = this.query().trim().toLowerCase();
    if (!needle) {
      return this.options();
    }
    return this.options().filter((opt) => opt.label.toLowerCase().includes(needle));
  });

  private onChange: (value: unknown) => void = () => {};
  private onTouched: () => void = () => {};

  // --- ControlValueAccessor ---
  writeValue(value: unknown): void {
    this.value.set(value ?? null);
  }
  registerOnChange(fn: (value: unknown) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.cvaDisabled.set(isDisabled);
  }

  protected isSelected(opt: SelectOption): boolean {
    return this.same(opt.value, this.value());
  }

  protected toggle(): void {
    if (this.disabled()) {
      return;
    }
    this.open() ? this.closePanel() : this.openPanel();
  }

  private openPanel(): void {
    this.open.set(true);
    this.query.set('');
    this.active.set(Math.max(0, this.visible().findIndex((opt) => this.isSelected(opt))));
    setTimeout(() => this.searchBox()?.nativeElement.focus());
  }

  private closePanel(): void {
    this.open.set(false);
    this.onTouched();
  }

  protected choose(opt: SelectOption | null): void {
    if (opt?.disabled) {
      return;
    }
    const next = opt ? opt.value : null;
    this.value.set(next);
    this.onChange(next);
    this.closePanel();
    this.triggerBtn()?.nativeElement.focus();
  }

  protected onTriggerKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!this.open()) {
        this.openPanel();
      }
    }
  }

  protected onSearchKey(event: KeyboardEvent): void {
    const items = this.visible();
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closePanel();
      this.triggerBtn()?.nativeElement.focus();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const lower = this.clearable() ? -1 : 0;
      this.active.update((current) =>
        Math.max(lower, Math.min(items.length - 1, current + delta)),
      );
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const index = this.active();
      if (index === -1) {
        this.choose(null);
      } else if (items[index]) {
        this.choose(items[index]);
      }
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  protected onDocumentPointerDown(event: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.closePanel();
    }
  }

  /** Values are compared loosely for primitives so a number stays a number through `ngModel`. */
  private same(a: unknown, b: unknown): boolean {
    if (a === b) {
      return true;
    }
    if (a === null || a === undefined || b === null || b === undefined) {
      return false;
    }
    if (typeof a === 'object' || typeof b === 'object') {
      return a === b;
    }
    return String(a) === String(b);
  }
}
