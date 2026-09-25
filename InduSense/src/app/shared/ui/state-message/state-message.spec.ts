import { TestBed } from '@angular/core/testing';

import { EmptyStateComponent } from './empty-state.component';
import { ErrorStateComponent } from './error-state.component';

describe('EmptyStateComponent', () => {
  it('renders heading and message as a status', () => {
    const fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput('message', 'Nothing yet');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.getAttribute('role')).toBe('status');
    expect(el.querySelector('.state__title')?.textContent).toBe('No data');
    expect(el.querySelector('.state__message')?.textContent).toBe('Nothing yet');
  });
});

describe('ErrorStateComponent', () => {
  it('emits retry when the button is clicked', () => {
    const fixture = TestBed.createComponent(ErrorStateComponent);
    let retries = 0;
    fixture.componentInstance.retry.subscribe(() => retries++);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.getAttribute('role')).toBe('alert');
    el.querySelector('button')!.click();
    expect(retries).toBe(1);
  });

  it('disables the button while retrying and hides it when not retryable', () => {
    const fixture = TestBed.createComponent(ErrorStateComponent);
    fixture.componentRef.setInput('retrying', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('button')!.disabled).toBe(true);

    fixture.componentRef.setInput('retryable', false);
    fixture.detectChanges();
    expect(el.querySelector('button')).toBeNull();
  });
});
