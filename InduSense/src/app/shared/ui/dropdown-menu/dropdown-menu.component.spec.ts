import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DropdownMenuComponent, MenuItem } from './dropdown-menu.component';

@Component({
  imports: [DropdownMenuComponent],
  template: `
    <app-dropdown-menu [items]="items" (itemSelect)="selected.set($event)"
      >Actions</app-dropdown-menu
    >
    <p class="outside">outside</p>
  `,
})
class HostComponent {
  readonly items: MenuItem[] = [
    { id: 'export', label: 'Export PDF' },
    { id: 'edit', label: 'Edit Layout', disabled: true },
    { id: 'reset', label: 'Reset view' },
  ];
  readonly selected = signal<string | null>(null);
}

describe('DropdownMenuComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let el: HTMLElement;

  const trigger = () => el.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;
  const menu = () => el.querySelector('[role="menu"]') as HTMLElement | null;
  const items = () => Array.from(el.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
  const key = (target: HTMLElement, name: string) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));

  beforeEach(async () => {
    fixture = TestBed.createComponent(HostComponent);
    el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    await fixture.whenStable();
  });

  afterEach(() => el.remove());

  it('opens on click, focuses the first item and reflects aria-expanded', async () => {
    expect(menu()).toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');

    trigger().click();
    await fixture.whenStable();

    expect(menu()).not.toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(trigger().getAttribute('aria-controls')).toBe(menu()!.id);
    expect(document.activeElement).toBe(items()[0]);
  });

  it('moves focus with arrow keys, skipping disabled items and wrapping', async () => {
    trigger().click();
    await fixture.whenStable();

    key(menu()!, 'ArrowDown');
    expect(document.activeElement).toBe(items()[2]);
    key(menu()!, 'ArrowDown');
    expect(document.activeElement).toBe(items()[0]);
    key(menu()!, 'ArrowUp');
    expect(document.activeElement).toBe(items()[2]);
    key(menu()!, 'Home');
    expect(document.activeElement).toBe(items()[0]);
    key(menu()!, 'End');
    expect(document.activeElement).toBe(items()[2]);
  });

  it('opens on the last item with ArrowUp from the trigger', async () => {
    key(trigger(), 'ArrowUp');
    await fixture.whenStable();
    expect(document.activeElement).toBe(items()[2]);
  });

  it('emits the selected id, closes and returns focus to the trigger', async () => {
    trigger().click();
    await fixture.whenStable();

    items()[2].click();
    await fixture.whenStable();

    expect(fixture.componentInstance.selected()).toBe('reset');
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('ignores disabled items', async () => {
    trigger().click();
    await fixture.whenStable();
    expect(items()[1].disabled).toBe(true);
    items()[1].click();
    expect(fixture.componentInstance.selected()).toBeNull();
  });

  it('closes on Escape and returns focus', async () => {
    trigger().click();
    await fixture.whenStable();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();

    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('closes on a click outside', async () => {
    trigger().click();
    await fixture.whenStable();

    (el.querySelector('.outside') as HTMLElement).click();
    await fixture.whenStable();

    expect(menu()).toBeNull();
  });
});
