import { TestBed } from '@angular/core/testing';

import { ChartThemeService } from '../../../../shared/charts/chart-theme.service';
import { buildPieOptions, foldToOther, pieSummary } from './pie-chart.options';

interface PieSeries {
  center: string[];
  data: { name: string; value: number }[];
  label: { formatter: (p: { value: number }) => string };
  itemStyle: { borderColor: string; borderWidth: number };
}

describe('pie chart options', () => {
  const theme = () => TestBed.inject(ChartThemeService).theme;

  it('folds categories beyond the palette into "Other" and drops zero slices', () => {
    const slices = Array.from({ length: 10 }, (_, i) => ({ label: `T${i}`, value: 10 - i }));
    const folded = foldToOther([...slices, { label: 'Zero', value: 0 }], 8);
    expect(folded).toHaveLength(8);
    expect(folded.slice(0, 7).map((s) => s.label)).toEqual([
      'T0',
      'T1',
      'T2',
      'T3',
      'T4',
      'T5',
      'T6',
    ]);
    expect(folded[7]).toEqual({ label: 'Other', value: 3 + 2 + 1 });
    expect(foldToOther([{ label: 'A', value: 0 }], 8)).toEqual([]);
  });

  it('labels a single 100% slice and hides labels on tiny slices', () => {
    const one = buildPieOptions([{ label: 'Gateway', value: 1 }], theme(), false) as {
      series: PieSeries[];
    };
    expect(one.series[0].label.formatter({ value: 1 })).toBe('100%');

    const many = buildPieOptions(
      [
        { label: 'A', value: 95 },
        { label: 'B', value: 5 },
      ],
      theme(),
      false,
    ) as { series: PieSeries[] };
    expect(many.series[0].label.formatter({ value: 5 })).toBe('');
  });

  it('uses the categorical palette, a surface gap and a responsive layout', () => {
    const wide = buildPieOptions([{ label: 'A', value: 1 }], theme(), false) as {
      color: string[];
      legend: { orient: string };
      series: PieSeries[];
    };
    expect(wide.color[0]).toBe('#3987e5');
    expect(wide.series[0].itemStyle).toEqual({ borderColor: theme().surface, borderWidth: 2 });
    expect(wide.legend.orient).toBe('vertical');

    const compact = buildPieOptions([{ label: 'A', value: 1 }], theme(), true) as {
      legend: { orient: string };
      series: PieSeries[];
    };
    expect(compact.legend.orient).toBe('horizontal');
    expect(compact.series[0].center).toEqual(['50%', '40%']);
  });

  it('escapes category names in the tooltip', () => {
    const options = buildPieOptions([{ label: '<b>x</b>', value: 1 }], theme(), false) as {
      tooltip: { formatter: (p: { name: string; value: number; color: string }) => string };
    };
    const html = options.tooltip.formatter({ name: '<b>x</b>', value: 1, color: '#000' });
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).not.toContain('<b>x</b>');
  });

  it('summarises the chart as text', () => {
    expect(
      pieSummary('Device Count by type', [
        { label: 'PLC', value: 3 },
        { label: 'Gateway', value: 1 },
      ]),
    ).toBe('Device Count by type: PLC 3 (75%), Gateway 1 (25%)');
  });
});
