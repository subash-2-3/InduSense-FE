import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DashboardToolbarComponent } from './dashboard-toolbar.component';

describe('DashboardToolbarComponent', () => {
  async function setup(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(DashboardToolbarComponent);
    fixture.componentRef.setInput('dashboards', [
      { id: 'device-summary', name: 'Device Summary' },
      { id: 'energy', name: 'Energy' },
    ]);
    fixture.componentRef.setInput('activeId', 'device-summary');
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => (document.body.innerHTML = ''));

  it('shows the active dashboard name as the page heading', async () => {
    const { el } = await setup();
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Device Summary');
  });

  it('shows how long ago the data was updated', async () => {
    const { fixture, el } = await setup();
    expect(el.querySelector('.toolbar__updated')?.textContent).toBe('Not updated yet');
    fixture.componentRef.setInput('lastUpdated', Date.now() - 12_000);
    await fixture.whenStable();
    // The 1 s ticker may lag the freshly set timestamp by up to one tick.
    expect(el.querySelector('.toolbar__updated')?.textContent).toMatch(/^Updated 1[12]s ago$/);
  });

  it('emits refresh, but not while a refresh is running', async () => {
    const { fixture, el } = await setup();
    let count = 0;
    fixture.componentInstance.refresh.subscribe(() => count++);
    const button = el.querySelector<HTMLButtonElement>('.refresh')!;
    button.click();
    expect(count).toBe(1);

    fixture.componentRef.setInput('refreshing', true);
    await fixture.whenStable();
    expect(button.classList).toContain('refresh--spinning');
    expect(button.getAttribute('aria-busy')).toBe('true');
    button.click();
    expect(count).toBe(1);
  });

  it('lists dashboards with the active one checked and emits only real changes', async () => {
    const { fixture, el } = await setup();
    const changes: string[] = [];
    fixture.componentInstance.dashboardChange.subscribe((id) => changes.push(id));

    el.querySelector<HTMLButtonElement>('h1 button')!.click();
    await fixture.whenStable();
    const options = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
    expect(options.map((o) => o.getAttribute('aria-checked'))).toEqual(['true', 'false']);

    options[0].click();
    expect(changes).toEqual([]);

    el.querySelector<HTMLButtonElement>('h1 button')!.click();
    await fixture.whenStable();
    el.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')[1].click();
    expect(changes).toEqual(['energy']);
  });

  it('prints for Export PDF and keeps Edit Layout disabled', async () => {
    const { fixture, el } = await setup();
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);

    el.querySelector<HTMLButtonElement>('.toolbar__end app-dropdown-menu button')!.click();
    await fixture.whenStable();
    const items = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    expect(items.map((i) => i.querySelector('.menu-item__label')?.textContent)).toEqual([
      'Export PDF',
      'Edit Layout',
    ]);
    expect(items[1].querySelector('.menu-item__hint')?.textContent).toBe('Soon');
    expect(items[1].disabled).toBe(true);

    items[0].click();
    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
  });

  it('shows Add Dashboard as unavailable', async () => {
    const { el } = await setup();
    const add = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Add Dashboard'),
    )!;
    expect(add.getAttribute('aria-disabled')).toBe('true');
    expect(add.getAttribute('title')).toBe('Coming soon');
  });
});
