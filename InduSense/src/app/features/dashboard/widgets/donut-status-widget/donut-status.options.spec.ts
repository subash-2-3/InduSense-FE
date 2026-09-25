import { TestBed } from '@angular/core/testing';

import { ChartThemeService } from '../../../../shared/charts/chart-theme.service';
import { StatusSliceVm } from '../../models/dashboard.vm';
import { buildDonutOptions, donutSummary } from './donut-status.options';

describe('donut status options', () => {
  const slices: StatusSliceVm[] = [
    { label: 'Online', value: 8, tone: 'running' },
    { label: 'Offline', value: 3, tone: 'warning' },
    { label: 'Never seen', value: 1, tone: 'stopped' },
  ];

  it('builds a 65–85% ring colored by status with the total in the center', () => {
    const { theme } = TestBed.inject(ChartThemeService);
    const options = buildDonutOptions(slices, theme, 'Devices count', false) as {
      title: { text: string; subtext: string };
      legend: { formatter: (name: string) => string };
      series: { radius: string[]; data: { itemStyle: { color: string } }[] }[];
    };
    expect(options.series[0].radius).toEqual(['65%', '85%']);
    expect(options.series[0].data.map((d) => d.itemStyle.color)).toEqual([
      theme.status.running,
      theme.status.warning,
      theme.status.stopped,
    ]);
    expect(options.title.text).toBe('Devices count');
    expect(options.title.subtext).toBe('12');
    expect(options.legend.formatter('Online')).toBe('Online  8 (67%)');
  });

  it('summarises the chart as text', () => {
    expect(donutSummary('Device By Connection status', slices)).toBe(
      'Device By Connection status: 12 in total. Online 8 (67%), Offline 3 (25%), Never seen 1 (8%)',
    );
  });
});
