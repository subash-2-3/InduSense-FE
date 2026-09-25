import { TestBed } from '@angular/core/testing';

import { IconComponent } from './icon.component';
import { ICONS } from './icons';

describe('IconComponent', () => {
  function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(IconComponent);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders every path of the icon at the requested size', () => {
    const el = render({ name: 'router', size: 24 });
    const svg = el.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('24');
    expect(svg.querySelectorAll('path').length).toBe(ICONS.router.length);
  });

  it('is decorative without a label', () => {
    const el = render({ name: 'search' });
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.getAttribute('role')).toBeNull();
  });

  it('is announced as an image with a label', () => {
    const el = render({ name: 'search', label: 'Search' });
    expect(el.getAttribute('role')).toBe('img');
    expect(el.getAttribute('aria-label')).toBe('Search');
    expect(el.getAttribute('aria-hidden')).toBeNull();
  });

  it('defines only non-empty icons', () => {
    for (const paths of Object.values(ICONS)) {
      expect(paths.length).toBeGreaterThan(0);
    }
  });
});
