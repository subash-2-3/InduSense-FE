import { TestBed } from '@angular/core/testing';

import { StatusPillComponent } from './status-pill.component';

describe('StatusPillComponent', () => {
  it('renders the label and exposes the tone for styling', () => {
    const fixture = TestBed.createComponent(StatusPillComponent);
    fixture.componentRef.setInput('label', 'Running');
    fixture.componentRef.setInput('tone', 'running');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent?.trim()).toBe('Running');
    expect(el.getAttribute('data-tone')).toBe('running');
    expect(el.querySelector('.pill__dot')).toBeNull();
  });

  it('defaults to the stopped tone and can show a dot', () => {
    const fixture = TestBed.createComponent(StatusPillComponent);
    fixture.componentRef.setInput('label', 'Unknown');
    fixture.componentRef.setInput('dot', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.getAttribute('data-tone')).toBe('stopped');
    expect(el.querySelector('.pill__dot')).not.toBeNull();
  });
});
