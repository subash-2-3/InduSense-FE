import { TestBed } from '@angular/core/testing';

import { EchartDirective } from '../../../../shared/charts/echart.directive';
import { FakeEchartDirective } from '../testing';
import { RadialGaugeWidgetComponent } from './radial-gauge-widget.component';

describe('RadialGaugeWidgetComponent', () => {
  async function render(inputs: Record<string, unknown>) {
    TestBed.overrideComponent(RadialGaugeWidgetComponent, {
      remove: { imports: [EchartDirective] },
      add: { imports: [FakeEchartDirective] },
    });
    const fixture = TestBed.createComponent(RadialGaugeWidgetComponent);
    fixture.componentRef.setInput('heading', 'watts');
    fixture.componentRef.setInput('min', 34);
    fixture.componentRef.setInput('max', 45);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the reading, unit and scale', async () => {
    const el = await render({ gauge: { value: 41.64, unit: 'W', ts: null } });
    expect(el.querySelector('.gauge__value')?.textContent).toBe('41.6');
    expect(el.querySelector('.gauge__unit')?.textContent).toBe('W');
    expect(Array.from(el.querySelectorAll('.gauge__scale span')).map((s) => s.textContent)).toEqual(
      ['34', '45'],
    );
    expect(el.querySelector('.gauge__range')).toBeNull();
    expect(el.querySelector('.gauge')?.getAttribute('aria-label')).toBe(
      'watts: 41.6 W on a scale of 34 to 45',
    );
  });

  it('shows the real value and flags it when it is outside the scale', async () => {
    const el = await render({ gauge: { value: 2, unit: 'W', ts: null } });
    expect(el.querySelector('.gauge__value')?.textContent).toBe('2');
    expect(el.querySelector('.gauge__range')?.textContent?.trim()).toBe('Below range');
    expect(el.querySelector('.gauge')?.getAttribute('aria-label')).toContain('below range');
  });

  it('shows when the reading was taken', async () => {
    const el = await render({ gauge: { value: 40, unit: 'W', ts: '2026-09-25T10:00:00Z' } });
    expect(el.querySelector('.gauge__time')?.textContent).toMatch(/^Sep 25, 2026 \d\d:\d\d [AP]M$/);
  });

  it('shows an empty state until there is a reading', async () => {
    const el = await render({ gauge: { value: null, unit: 'W', ts: null } });
    expect(el.querySelector('app-empty-state .state__title')?.textContent).toBe('No reading yet');
  });
});
