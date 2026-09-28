import { TestBed } from '@angular/core/testing';

import { LiveParameter, TrendGroup } from '../../core/models';
import { ChartThemeService } from '../../shared/charts/chart-theme.service';
import {
  buildDistributionOptions,
  buildTrendOptions,
  formatKpi,
  formatQuantity,
  formatValue,
  groupTagsByUnit,
  trendTitle,
} from './energy-charts';

const tag = (tag_id: number, name: string, unit: string | null): LiveParameter => ({
  tag_id,
  metric: 'POWER',
  name,
  unit,
  value: null,
  ts: null,
  quality: null,
  device_id: 1,
  device_name: null,
  connection_state: 'ONLINE',
});

describe('energy formatting', () => {
  it('uses decimals that suit the magnitude and shows the unit', () => {
    expect(formatValue(249.199997, 'V')).toBe('249.2 V');
    expect(formatValue(0.0452, 'A')).toBe('0.0452 A');
    expect(formatValue(1234.56, 'kWh')).toBe('1,234.6 kWh');
    expect(formatValue(null, 'kW')).toBe('—');
    expect(formatKpi({ value: 0.14, unit: 'kW' })).toBe('0.14 kW');
    expect(formatKpi(null)).toBe('—');
  });

  it('never adds different units together', () => {
    expect(formatQuantity({ total: 25, unit: 'kWh', by_unit: { kWh: 25 } })).toBe('25 kWh');
    expect(formatQuantity({ total: null, unit: null, by_unit: { kWh: 25, Wh: 300 } })).toBe(
      '25 kWh + 300 Wh',
    );
    expect(formatQuantity(null)).toBe('—');
  });
});

describe('tag picker groups', () => {
  it('groups tags by unit, tags without a unit last', () => {
    const groups = groupTagsByUnit([
      tag(1, 'PF', null),
      tag(2, 'Power A', 'kW'),
      tag(3, 'Voltage', 'V'),
      tag(4, 'Power B', 'kW'),
    ]);
    expect(groups.map((g) => [g.unit, g.tags.map((t) => t.tag_id)])).toEqual([
      ['kW', [2, 4]],
      ['V', [3]],
      ['No unit', [1]],
    ]);
  });
});

describe('energy chart options', () => {
  const theme = () => TestBed.inject(ChartThemeService).theme;
  const group = (kind: string, names: string[]): TrendGroup => ({
    unit: 'kW',
    kind,
    series: names.map((name, i) => ({
      tag_id: i + 1,
      metric: kind === 'consumption' ? 'ENERGY' : 'POWER',
      name,
      unit: 'kW',
      asset_name: `Meter ${i + 1}`,
      points: [
        { t: '2026-09-01T00:00:00Z', value: 30 },
        { t: '2026-09-01T00:15:00Z', value: 40 },
      ],
    })),
  });

  it('draws instantaneous values as lines and consumption as bars', () => {
    const lines = buildTrendOptions(group('instant', ['Power']), theme()) as {
      series: { type: string; data: unknown[] }[];
      legend: { show?: boolean };
    };
    expect(lines.series[0].type).toBe('line');
    expect(lines.series[0].data).toEqual([
      ['2026-09-01T00:00:00Z', 30],
      ['2026-09-01T00:15:00Z', 40],
    ]);
    expect(lines.legend.show).toBe(false);
    const bars = buildTrendOptions(group('consumption', ['Energy']), theme()) as {
      series: { type: string }[];
    };
    expect(bars.series[0].type).toBe('bar');
  });

  it('names same-named series by asset', () => {
    const options = buildTrendOptions(group('instant', ['Power', 'Power']), theme()) as {
      series: { name: string }[];
    };
    expect(options.series.map((s) => s.name)).toEqual(['Power · Meter 1', 'Power · Meter 2']);
  });

  it('titles a group by its metrics and unit', () => {
    expect(trendTitle(group('instant', ['Power']))).toBe('Power (kW)');
    expect(trendTitle(group('consumption', ['Energy']))).toBe('Energy consumed per interval (kW)');
  });

  it('builds a pie or a bar chart of the distribution', () => {
    const items = [
      { key: 'meter:1', id: 1, name: 'A', value: 75, unit: 'kWh', share: 0.75 },
      { key: 'meter:2', id: 2, name: 'B', value: 25, unit: 'kWh', share: 0.25 },
    ];
    const pie = buildDistributionOptions(items, 'pie', theme(), false) as {
      series: { type: string; data: { name: string }[] }[];
    };
    expect(pie.series[0].type).toBe('pie');
    expect(pie.series[0].data.map((d) => d.name)).toEqual(['A', 'B']);
    const bar = buildDistributionOptions(items, 'bar', theme(), false) as {
      yAxis: { data: string[] };
      series: { data: number[] }[];
    };
    expect(bar.yAxis.data).toEqual(['B', 'A']); // largest on top
    expect(bar.series[0].data).toEqual([25, 75]);
  });
});
