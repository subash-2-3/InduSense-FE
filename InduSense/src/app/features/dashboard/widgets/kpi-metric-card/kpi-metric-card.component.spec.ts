import { TestBed } from '@angular/core/testing';

import { KpiMetricCardComponent } from './kpi-metric-card.component';

describe('KpiMetricCardComponent', () => {
  async function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(KpiMetricCardComponent);
    fixture.componentRef.setInput('heading', 'Devices');
    fixture.componentRef.setInput('subtitle', 'Devices count');
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the heading, formatted value, subtitle and icon badge', async () => {
    const { el } = await render({ kpi: { value: 1234 }, icon: 'package' });
    expect(el.querySelector('h2')?.textContent).toBe('Devices');
    expect(el.querySelector('.kpi__value')?.textContent).toBe('1,234');
    expect(el.querySelector('.kpi__subtitle')?.textContent).toBe('Devices count');
    expect(el.querySelectorAll('.kpi__badge path').length).toBeGreaterThan(0);
  });

  it('shows zero as a value, not as empty', async () => {
    const { el } = await render({ kpi: { value: 0 } });
    expect(el.querySelector('.kpi__value')?.textContent).toBe('0');
  });

  it('shows a skeleton while loading', async () => {
    const { el } = await render({ loading: true });
    expect(el.querySelectorAll('app-skeleton').length).toBe(3);
    expect(el.querySelector('.kpi__value')).toBeNull();
  });

  it('shows a compact error with Retry', async () => {
    const { fixture, el } = await render({ error: 'Server down' });
    let retries = 0;
    fixture.componentInstance.retry.subscribe(() => retries++);
    const state = el.querySelector('app-error-state')!;
    expect(state.classList).toContain('state--compact');
    state.querySelector('button')!.click();
    expect(retries).toBe(1);
  });

  it('shows the empty state without data', async () => {
    const { el } = await render({});
    expect(el.querySelector('app-empty-state')).not.toBeNull();
  });
});
