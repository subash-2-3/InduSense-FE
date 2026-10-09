import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DrawerComponent } from './drawer.component';

@Component({
  imports: [DrawerComponent],
  template: `
    <app-drawer [open]="open()" title="Add device" subtitle="demo" (close)="closed = closed + 1">
      <input id="first" />
      <button id="inside">inside</button>
    </app-drawer>
  `,
})
class HostComponent {
  readonly open = signal(true);
  closed = 0;
}

function setup(open = true) {
  TestBed.configureTestingModule({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.open.set(open);
  fixture.detectChanges();
  return fixture;
}

const tick = () => new Promise((resolve) => setTimeout(resolve));

describe('DrawerComponent', () => {
  it('renders its title and projected content when open', () => {
    const el = setup(true).nativeElement as HTMLElement;
    expect(el.querySelector('.drawer-title')?.textContent).toContain('Add device');
    expect(el.querySelector('#first')).not.toBeNull();
  });

  it('renders nothing when closed', () => {
    const el = setup(false).nativeElement as HTMLElement;
    expect(el.querySelector('.drawer-panel')).toBeNull();
  });

  it('emits close on Escape', () => {
    const fixture = setup(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(fixture.componentInstance.closed).toBe(1);
  });

  it('emits close on a pointer-down outside the panel', async () => {
    const fixture = setup(true);
    await tick(); // the outside-click listener attaches on a deferred tick
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(fixture.componentInstance.closed).toBe(1);
  });

  it('does not close when the pointer-down is inside the panel', async () => {
    const fixture = setup(true);
    await tick();
    const inside = (fixture.nativeElement as HTMLElement).querySelector('#inside')!;
    inside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(fixture.componentInstance.closed).toBe(0);
  });
});
