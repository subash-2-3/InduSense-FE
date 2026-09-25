import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ButtonComponent, ButtonVariant } from './button.component';

@Component({
  imports: [ButtonComponent],
  template: `<button appButton type="button" [variant]="variant()" [loading]="loading()">
    Go
  </button>`,
})
class HostComponent {
  readonly variant = signal<ButtonVariant>('primary');
  readonly loading = signal(false);
}

describe('ButtonComponent', () => {
  it('applies the variant class', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.classList).toContain('btn');
    expect(button.classList).toContain('btn--primary');

    fixture.componentInstance.variant.set('ghost');
    await fixture.whenStable();
    expect(button.classList).toContain('btn--ghost');
    expect(button.classList).not.toContain('btn--primary');
  });

  it('shows a spinner and aria-busy while loading', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.loading.set(true);
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.querySelector('.btn__spinner')).not.toBeNull();
    expect(button.textContent).toContain('Go');
  });
});
