import {
  escapeHtml,
  legendBase,
  percentLabel,
  readableInk,
  sum,
  swatch,
  tooltipBase,
} from '../../../../shared/charts/chart-base';
import type { ChartTheme } from '../../../../shared/charts/chart-theme.service';
import type { ChartOptions } from '../../../../shared/charts/echarts-setup';
import { CategorySliceVm } from '../../models/dashboard.vm';

/**
 * Keeps at most `maxSlices` slices: the largest `maxSlices - 1` plus an "Other" slice summing the
 * rest. Categorical colors are never cycled or generated past the palette.
 */
export function foldToOther(
  slices: readonly CategorySliceVm[],
  maxSlices: number,
): CategorySliceVm[] {
  const positive = slices.filter((s) => s.value > 0);
  if (positive.length <= maxSlices) {
    return positive;
  }
  const sorted = [...positive].sort((a, b) => b.value - a.value);
  const kept = sorted.slice(0, maxSlices - 1);
  const other = sum(sorted.slice(maxSlices - 1).map((s) => s.value));
  return [...kept, { label: 'Other', value: other }];
}

export function buildPieOptions(
  input: readonly CategorySliceVm[],
  theme: ChartTheme,
  compact: boolean,
): ChartOptions {
  const slices = foldToOther(input, theme.categorical.length);
  const total = sum(slices.map((s) => s.value));
  const center = compact ? ['50%', '40%'] : ['36%', '50%'];

  return {
    animation: theme.animation,
    color: [...theme.categorical],
    textStyle: { fontFamily: theme.fontSans },
    tooltip: {
      ...tooltipBase(theme),
      trigger: 'item',
      formatter: (p: { name: string; value: number; color: string }) =>
        `${swatch(p.color)}${escapeHtml(p.name)}: <b>${p.value}</b> (${percentLabel(p.value, total)})`,
    },
    legend: {
      ...legendBase(theme),
      // Plain legend: wraps onto more lines when narrow instead of paging (<= 8 entries).
      type: 'plain',
      orient: compact ? 'horizontal' : 'vertical',
      ...(compact ? { bottom: 0, left: 'center', right: 8 } : { right: 8, top: 'middle' }),
    },
    series: [
      {
        type: 'pie',
        radius: ['0%', compact ? '58%' : '72%'],
        center,
        // In-slice labels take the text ink with the higher contrast on that slice (>= 4.5:1).
        data: slices.map((s, i) => ({
          name: s.label,
          value: s.value,
          label: {
            color: readableInk(theme.categorical[i], theme.text.primary, theme.inkOnLight),
          },
        })),
        // 2px surface-colored gap between slices (no outline strokes).
        itemStyle: { borderColor: theme.surface, borderWidth: 2 },
        label: {
          show: true,
          position: 'inside',
          fontWeight: 600,
          fontSize: 12,
          // Label only slices large enough to hold it; the legend and tooltip carry the rest.
          formatter: (p: { value: number }) =>
            p.value / total >= 0.08 ? percentLabel(p.value, total) : '',
        },
        labelLine: { show: false },
        emphasis: { scale: true, scaleSize: 4 },
      },
    ],
  };
}

/** Text alternative for the chart. */
export function pieSummary(heading: string, input: readonly CategorySliceVm[]): string {
  const slices = foldToOther(input, 8);
  const total = sum(slices.map((s) => s.value));
  const parts = slices.map((s) => `${s.label} ${s.value} (${percentLabel(s.value, total)})`);
  return `${heading}: ${parts.join(', ')}`;
}
