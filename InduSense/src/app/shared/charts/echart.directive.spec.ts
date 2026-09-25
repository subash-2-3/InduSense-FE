import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { EchartDirective } from './echart.directive';
import { ChartOptions, echarts } from './echarts-setup';

@Component({
  imports: [EchartDirective],
  template: `
    @if (show()) {
      <div class="chart" style="width: 300px; height: 200px" [appEchart]="options()"></div>
    }
  `,
})
class HostComponent {
  readonly show = signal(true);
  readonly options = signal<ChartOptions>({
    animation: false,
    series: [{ type: 'pie', data: [{ name: 'A', value: 1 }] }],
  });
}

describe('EchartDirective', () => {
  beforeEach(() => {
    // jsdom has no layout, so ECharts warns about a zero-size container.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('initialises after render, follows option changes and disposes with the view', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement.querySelector('.chart') as HTMLElement;

    const chart = echarts.getInstanceByDom(el);
    expect(chart).toBeDefined();
    expect(el.classList).toContain('echart');
    const series = () => (chart!.getOption()['series'] as { data: { name: string }[] }[])[0];
    expect(series().data.map((d) => d.name)).toEqual(['A']);

    fixture.componentInstance.options.set({
      animation: false,
      series: [{ type: 'pie', data: [{ name: 'B', value: 2 }] }],
    });
    await fixture.whenStable();
    expect(series().data.map((d) => d.name)).toEqual(['B']);

    fixture.componentInstance.show.set(false);
    await fixture.whenStable();
    expect(chart!.isDisposed()).toBe(true);
  });
});
