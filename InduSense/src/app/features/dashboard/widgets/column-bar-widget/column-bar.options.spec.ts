import { TestBed } from '@angular/core/testing';

import { ChartThemeService } from '../../../../shared/charts/chart-theme.service';
import { StackedBarVm } from '../../models/dashboard.vm';
import {
  buildColumnBarOptions,
  categoryLabelWidth,
  columnBarSummary,
  topSeriesIndex,
} from './column-bar.options';

interface BarSeries {
  name: string;
  stack: string;
  barMaxWidth: number;
  itemStyle: { color: string };
  data: { value: number; itemStyle: { borderRadius: number | number[] } }[];
}

describe('column bar options', () => {
  const data: StackedBarVm = {
    categories: ['MQTT', 'VNET', 'OPCUA'],
    series: [
      { label: 'Online', tone: 'running', values: [3, 2, 0] },
      { label: 'Offline', tone: 'warning', values: [1, 0, 0] },
    ],
  };

  it('finds the top-most non-zero segment of each column', () => {
    expect(topSeriesIndex(data)).toEqual([1, 0, -1]);
  });

  it('rounds only the top of each stack and stacks with the status colors', () => {
    const { theme } = TestBed.inject(ChartThemeService);
    const options = buildColumnBarOptions(data, theme, { xAxis: 'X', yAxis: 'Y' }) as {
      series: BarSeries[];
      yAxis: { minInterval: number; name: string };
      xAxis: { name: string };
    };
    const [online, offline] = options.series;
    expect(online.stack).toBe(offline.stack);
    expect(online.barMaxWidth).toBe(36);
    expect(online.itemStyle.color).toBe(theme.status.running);
    expect(online.data.map((d) => d.itemStyle.borderRadius)).toEqual([0, [4, 4, 0, 0], 0]);
    expect(offline.data.map((d) => d.itemStyle.borderRadius)).toEqual([[4, 4, 0, 0], 0, 0]);
    expect(options.yAxis.minInterval).toBe(1);
    expect([options.xAxis.name, options.yAxis.name]).toEqual(['X', 'Y']);
  });

  it('gives every category a label, truncated to the space available', () => {
    expect(categoryLabelWidth(0, 4)).toBe(0);
    expect(categoryLabelWidth(472, 4)).toBe(92);
    expect(categoryLabelWidth(200, 10)).toBe(32);
    const { theme } = TestBed.inject(ChartThemeService);
    const options = buildColumnBarOptions(data, theme, { xAxis: 'X', yAxis: 'Y' }, 472) as {
      xAxis: { axisLabel: { interval: number; width: number; overflow: string } };
    };
    expect(options.xAxis.axisLabel).toMatchObject({ interval: 0, overflow: 'truncate' });
  });

  it('escapes names in the tooltip and shows the column total', () => {
    const { theme } = TestBed.inject(ChartThemeService);
    const options = buildColumnBarOptions(data, theme, { xAxis: 'X', yAxis: 'Y' }) as {
      tooltip: {
        formatter: (
          p: { axisValue: string; seriesName: string; value: number; color: string }[],
        ) => string;
      };
    };
    const html = options.tooltip.formatter([
      { axisValue: '<i>MQTT</i>', seriesName: 'Online', value: 3, color: '#0f0' },
      { axisValue: '<i>MQTT</i>', seriesName: 'Offline', value: 1, color: '#f90' },
    ]);
    expect(html).toContain('&lt;i&gt;MQTT&lt;/i&gt;</b> · 4');
  });

  it('summarises the chart as text', () => {
    expect(columnBarSummary('Devices', data)).toBe(
      'Devices. MQTT: 3 online, 1 offline; VNET: 2 online, 0 offline; OPCUA: 0 online, 0 offline',
    );
  });
});
