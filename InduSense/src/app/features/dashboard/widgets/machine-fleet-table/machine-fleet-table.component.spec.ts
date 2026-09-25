import { TestBed } from '@angular/core/testing';

import { createMockFleet, mockFleetPage } from '../../data/dashboard.mock';
import { MachineFleetTableComponent } from './machine-fleet-table.component';

describe('MachineFleetTableComponent', () => {
  const fleet = createMockFleet(Date.parse('2026-09-25T12:00:00Z'));

  async function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(MachineFleetTableComponent);
    fixture.componentRef.setInput('heading', 'OEE');
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const names = () =>
      Array.from(el.querySelectorAll('tbody .fleet__name')).map((n) => n.textContent);
    const pager = () => Array.from(el.querySelectorAll<HTMLButtonElement>('.fleet__pager button'));
    return { fixture, el, names, pager };
  }

  it('renders a page of rows with every column', async () => {
    const { el, names } = await render({ fleet: mockFleetPage(1, 10, fleet) });
    expect(names()).toHaveLength(10);
    const headers = Array.from(el.querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headers).toEqual([
      'Asset Image',
      'Name',
      'Status',
      'Status Update Time',
      'Connection Status',
      'Located At',
      'Area',
      'Connected Gateway',
    ]);
    const first = el.querySelector('tbody tr')!;
    expect(first.querySelector('.col-status app-status-pill')?.textContent?.trim()).toBe('Running');
    expect(first.querySelector('.col-connection app-status-pill')?.getAttribute('data-tone')).toBe(
      'running',
    );
    expect(el.querySelector('.fleet__total')?.textContent).toBe('Total: 25 records');
    expect(el.querySelector('.fleet__page')?.textContent).toBe('1 of 3');
  });

  it('shows placeholders for missing area and gateway', async () => {
    const { el } = await render({ fleet: mockFleetPage(1, 10, fleet) });
    const unconnected = Array.from(el.querySelectorAll('tbody tr')).find((tr) =>
      tr.textContent?.includes('Unconnected Asset'),
    )!;
    expect(unconnected.querySelector('.col-gateway')?.textContent?.trim()).toBe('—');
  });

  it('sorts by name through the header button and reflects aria-sort', async () => {
    const { fixture, el, names } = await render({ fleet: mockFleetPage(1, 10, fleet) });
    const nameHeader = el.querySelector('th.col-name')!;
    expect(nameHeader.getAttribute('aria-sort')).toBe('none');
    expect(el.querySelector('th.col-updatedAt')?.hasAttribute('aria-sort')).toBe(false);

    nameHeader.querySelector('button')!.click();
    await fixture.whenStable();
    expect(nameHeader.getAttribute('aria-sort')).toBe('ascending');
    const asc = names();
    expect(asc).toEqual([...asc].sort((a, b) => a!.localeCompare(b!, 'en', { numeric: true })));

    nameHeader.querySelector('button')!.click();
    await fixture.whenStable();
    expect(nameHeader.getAttribute('aria-sort')).toBe('descending');
    expect(names()).toEqual([...asc].reverse());

    nameHeader.querySelector('button')!.click();
    await fixture.whenStable();
    expect(nameHeader.getAttribute('aria-sort')).toBe('none');
    expect(names()).toEqual(mockFleetPage(1, 10, fleet).rows.map((r) => r.name));
  });

  it('emits page changes and disables the pager at the bounds', async () => {
    const { fixture, pager } = await render({ fleet: mockFleetPage(1, 10, fleet) });
    const pages: number[] = [];
    fixture.componentInstance.pageChange.subscribe((p) => pages.push(p));

    expect(pager()[0].disabled).toBe(true);
    pager()[1].click();
    expect(pages).toEqual([2]);

    fixture.componentRef.setInput('fleet', mockFleetPage(3, 10, fleet));
    await fixture.whenStable();
    expect(pager()[1].disabled).toBe(true);
    pager()[0].click();
    expect(pages).toEqual([2, 2]);
  });

  it('keeps rows visible but blocks paging while a page loads', async () => {
    const { el, pager } = await render({ fleet: mockFleetPage(2, 10, fleet), loading: true });
    expect(el.querySelector('.fleet--busy')).not.toBeNull();
    expect(el.querySelector('.fleet__scroll')?.getAttribute('aria-busy')).toBe('true');
    expect(pager().every((b) => b.disabled)).toBe(true);
  });

  it('shows only the requested columns', async () => {
    const { el } = await render({
      fleet: mockFleetPage(1, 10, fleet),
      columns: ['name', 'status'],
    });
    expect(el.querySelectorAll('th')).toHaveLength(2);
    expect(el.querySelectorAll('tbody tr:first-child td')).toHaveLength(2);
  });

  it('shows the empty state for an empty fleet', async () => {
    const { el } = await render({ fleet: { rows: [], total: 0, page: 1, pageSize: 10 } });
    expect(el.querySelector('app-empty-state .state__title')?.textContent).toBe('No assets yet');
  });
});
