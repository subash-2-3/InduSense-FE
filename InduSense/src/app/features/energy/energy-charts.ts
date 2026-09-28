import {
  escapeHtml,
  legendBase,
  percentLabel,
  sum,
  swatch,
  textStyle,
  tooltipBase,
} from '../../shared/charts/chart-base';
import type { ChartTheme } from '../../shared/charts/chart-theme.service';
import type { ChartOptions } from '../../shared/charts/echarts-setup';
import { DistributionItem, KpiValue, LiveParameter, Quantity, TrendGroup } from '../../core/models';
import { EMPTY_VALUE, formatNumber } from '../../shared/utils/format';
import { buildPieOptions } from '../dashboard/widgets/pie-chart-widget/pie-chart.options';

/** Chart option builders and formatting of the energy dashboard (pure; unit tested). */

export const METRIC_LABELS: Readonly<Record<string, string>> = {
  POWER: 'Power',
  ENERGY: 'Energy',
  VOLTAGE: 'Voltage',
  CURRENT: 'Current',
  FREQUENCY: 'Frequency',
  POWER_FACTOR: 'Power factor',
};

/** Decimals that suit the magnitude: 249.2 V, 0.0452 A, 0.14 kW. */
export function fractionDigits(value: number): number {
  const abs = Math.abs(value);
  if (abs === 0 || abs >= 100) {
    return abs >= 1000 ? 1 : 2;
  }
  return abs >= 1 ? 2 : 4;
}

/**
 * A value with its unit. `roundoff` is the tag's configured decimals (display only); without it the
 * decimals suit the magnitude.
 */
export function formatValue(
  value: number | null | undefined,
  unit?: string | null,
  roundoff?: number | null,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return EMPTY_VALUE;
  }
  const digits = roundoff ?? fractionDigits(value);
  const text = formatNumber(value, {
    maximumFractionDigits: digits,
    minimumFractionDigits: roundoff ?? 0,
  });
  return unit ? `${text} ${unit}` : text;
}

export function formatKpi(kpi: KpiValue | null | undefined): string {
  return formatValue(kpi?.value, kpi?.unit);
}

/** One total, or every unit's own sum when units differ (never added together). */
export function formatQuantity(q: Quantity | null | undefined): string {
  if (!q) {
    return EMPTY_VALUE;
  }
  if (q.total !== null) {
    return formatValue(q.total, q.unit);
  }
  const parts = Object.entries(q.by_unit).map(([unit, value]) => formatValue(value, unit || null));
  return parts.length ? parts.join(' + ') : EMPTY_VALUE;
}

export interface TagOptionGroup {
  unit: string;
  tags: LiveParameter[];
}

/** Tag picker entries grouped by unit (tags without a unit last), each group in server order. */
export function groupTagsByUnit(tags: readonly LiveParameter[]): TagOptionGroup[] {
  const groups = new Map<string, LiveParameter[]>();
  for (const tag of tags) {
    const unit = tag.unit ?? '';
    groups.set(unit, [...(groups.get(unit) ?? []), tag]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : 0))
    .map(([unit, list]) => ({ unit: unit || 'No unit', tags: list }));
}

export function trendTitle(group: TrendGroup): string {
  const unit = group.unit ? ` (${group.unit})` : '';
  if (group.kind === 'consumption') {
    return `Energy consumed per interval${unit}`;
  }
  const names = [...new Set(group.series.map((s) => METRIC_LABELS[s.metric] ?? s.name))];
  return `${names.join(', ')}${unit}`;
}

/**
 * One chart per trend group (same unit and kind): lines of the bucket averages for instantaneous
 * values, bars of energy used per bucket for ENERGY registers.
 */
export function buildTrendOptions(group: TrendGroup, theme: ChartTheme): ChartOptions {
  const consumption = group.kind === 'consumption';
  const several = group.series.length > 1;
  const label = (s: TrendGroup['series'][number]) =>
    several && group.series.some((o) => o !== s && o.name === s.name)
      ? `${s.name} · ${s.asset_name}`
      : s.name;
  const digits = new Map(group.series.map((s) => [label(s), s.roundoff_digits ?? null]));
  return {
    animation: theme.animation,
    color: [...theme.categorical],
    textStyle: textStyle(theme),
    grid: { left: 8, right: 16, top: several ? 36 : 16, bottom: 8, containLabel: true },
    legend: several ? { ...legendBase(theme), type: 'scroll', top: 0, left: 0 } : { show: false },
    tooltip: {
      ...tooltipBase(theme),
      trigger: 'axis',
      formatter: (
        params: { color: string; seriesName: string; value: [string, number | null] }[],
      ) => {
        if (!params.length) {
          return '';
        }
        const when = new Date(params[0].value[0]).toLocaleString();
        const rows = params.map(
          (p) =>
            `${swatch(p.color)}${escapeHtml(p.seriesName)}: <b>${escapeHtml(formatValue(p.value[1], group.unit, digits.get(p.seriesName)))}</b>`,
        );
        return [escapeHtml(when), ...rows].join('<br/>');
      },
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: theme.axis } },
      axisLabel: { color: theme.text.secondary, hideOverlap: true },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      scale: !consumption,
      axisLabel: { color: theme.text.secondary },
      splitLine: { lineStyle: { color: theme.grid } },
    },
    series: group.series.map((s) => ({
      name: label(s),
      type: consumption ? 'bar' : 'line',
      showSymbol: s.points.length <= 1,
      symbolSize: 6,
      smooth: false,
      connectNulls: false,
      barMaxWidth: 24,
      lineStyle: { width: 2 },
      data: s.points.map((p) => [p.t, p.value]),
    })),
  };
}

export type DistributionChart = 'pie' | 'bar';

export function buildDistributionOptions(
  items: readonly DistributionItem[],
  chart: DistributionChart,
  theme: ChartTheme,
  compact: boolean,
): ChartOptions {
  if (chart === 'pie') {
    return buildPieOptions(
      items.map((i) => ({ label: i.name, value: i.value })),
      theme,
      compact,
    );
  }
  const total = sum(items.map((i) => i.value));
  const unit = items[0]?.unit ?? null;
  const ordered = [...items].reverse(); // largest on top
  return {
    animation: theme.animation,
    textStyle: textStyle(theme),
    grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      ...tooltipBase(theme),
      trigger: 'item',
      formatter: (p: { name: string; value: number; color: string }) =>
        `${swatch(p.color)}${escapeHtml(p.name)}: <b>${escapeHtml(formatValue(p.value, unit))}</b> (${percentLabel(p.value, total)})`,
    },
    xAxis: {
      type: 'value',
      axisLabel: { color: theme.text.secondary },
      splitLine: { lineStyle: { color: theme.grid } },
    },
    yAxis: {
      type: 'category',
      data: ordered.map((i) => i.name),
      axisLabel: { color: theme.text.secondary, width: 140, overflow: 'truncate' },
      axisLine: { lineStyle: { color: theme.axis } },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 22,
        itemStyle: { color: theme.categorical[0], borderRadius: [0, 3, 3, 0] },
        data: ordered.map((i) => i.value),
      },
    ],
  };
}
