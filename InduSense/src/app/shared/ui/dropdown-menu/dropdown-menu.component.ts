import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  booleanAttribute,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';

import { ButtonComponent, ButtonSize, ButtonVariant } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icons';

export interface MenuItem {
  id: string;
  label: string;
  icon?: IconName;
  hint?: string;
  disabled?: boolean;
  danger?: boolean;
  /** Renders a checkable item (`menuitemradio`); used for "current selection" menus. */
  checked?: boolean;
  /** Draws a divider above this item. */
  separatorBefore?: boolean;
}

let nextMenuId = 0;

/**
 * Menu button following the WAI-ARIA menu-button pattern. The trigger's content is projected:
 * `<app-dropdown-menu [items]="items" (itemSelect)="run($event)">Actions</app-dropdown-menu>`
 * Content marked `menuHeader` is shown at the top of the open panel (e.g. the signed-in user).
 *
 * Keyboard: Enter/Space/ArrowDown open on the first item, ArrowUp on the last; Arrow keys,
 * Home and End move between items; Escape closes and returns focus; Tab closes.
 */
@Component({
  selector: 'app-dropdown-menu',
  imports: [ButtonComponent, IconComponent],
  templateUrl: './dropdown-menu.component.html',
  styleUrl: './dropdown-menu.component.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'onEscape()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropdownMenuComponent {
  readonly items = input.required<readonly MenuItem[]>();
  readonly align = input<'start' | 'end'>('start');
  readonly triggerVariant = input<ButtonVariant>('secondary');
  readonly triggerSize = input<ButtonSize>('md');
  /** Accessible name for icon-only triggers. */
  readonly triggerLabel = input<string>();
  readonly showChevron = input(true, { transform: booleanAttribute });

  readonly itemSelect = output<string>();

  readonly isOpen = signal(false);

  protected readonly menuId = `app-menu-${nextMenuId++}`;
  protected readonly triggerId = `${this.menuId}-trigger`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild.required('trigger', { read: ElementRef<HTMLButtonElement> });
  private readonly menuItems = viewChildren<ElementRef<HTMLButtonElement>>('menuItem');

  toggle(): void {
    if (this.isOpen()) {
      this.close(true);
    } else {
      this.open('first');
    }
  }

  open(focus: 'first' | 'last' = 'first'): void {
    this.isOpen.set(true);
    afterNextRender(() => this.focusEdge(focus), { injector: this.injector });
  }

  close(restoreFocus: boolean): void {
    if (!this.isOpen()) {
      return;
    }
    this.isOpen.set(false);
    if (restoreFocus) {
      this.trigger().nativeElement.focus();
    }
  }

  protected select(item: MenuItem): void {
    if (item.disabled) {
      return;
    }
    this.itemSelect.emit(item.id);
    this.close(true);
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.open(event.key === 'ArrowDown' ? 'first' : 'last');
    }
  }

  protected onMenuKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveFocus(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveFocus(-1);
        break;
      case 'Home':
        event.preventDefault();
        this.focusEdge('first');
        break;
      case 'End':
        event.preventDefault();
        this.focusEdge('last');
        break;
      case 'Tab':
        this.close(false);
        break;
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.isOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close(false);
    }
  }

  protected onEscape(): void {
    this.close(true);
  }

  private enabledItems(): HTMLButtonElement[] {
    return this.menuItems()
      .map((ref) => ref.nativeElement)
      .filter((el) => !el.disabled);
  }

  private focusEdge(edge: 'first' | 'last'): void {
    const items = this.enabledItems();
    (edge === 'first' ? items[0] : items[items.length - 1])?.focus();
  }

  private moveFocus(step: 1 | -1): void {
    const items = this.enabledItems();
    if (items.length === 0) {
      return;
    }
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = current === -1 ? 0 : (current + step + items.length) % items.length;
    items[next].focus();
  }
}
