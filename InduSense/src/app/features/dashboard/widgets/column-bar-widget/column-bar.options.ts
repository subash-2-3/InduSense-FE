import {
  escapeHtml,
  legendBase,
  sum,
  swatch,
  tooltipBase,
} from '../../../../shared/charts/chart-base';
import type { ChartTheme } from '../../../../shared/charts/chart-theme.service';
import type { ChartOptions } from '../../../../shared/charts/echarts-setup';
import { StackedBarVm } from '../../models/dashboard.vm';

export interface ColumnBarLabels {
  xAxis: string;
  yAxis: string;
}

/** Index of the top-most series with a non-zero value in each category (-1 when all are zero). */
export function topSeriesIndex(data: StackedBarVm): number[] {
  return data.categories.map((_, c) => {
    for (let s = data.series.length - 1; s >= 0; s--) {
      if ((data.series[s].values[c] ?? 0) > 0) {
        return s;
      }
    }
    return -1;
  });
}

/** Width available to each category label; 0 when the chart has not been measured yet. */
export function categoryLabelWidth(chartWidth: number, categories: number): number {
  if (chartWidth <= 0 || categories <= 0) {
    return 0;
  }
  const plotWidth = chartWidth - 72; // grid left + right
  return Math.max(32, Math.floor(plotWidth / categories) - 8);
}

export function buildColumnBarOptions(
  data: StackedBarVm,
  theme: ChartTheme,
  labels: ColumnBarLabels,
  chartWidth = 0,
): ChartOptions {
  const tops = topSeriesIndex(data);
  const labelWidth = categoryLabelWidth(chartWidth, data.categories.length);
  const axisLabel = { color: theme.text.secondary, fontFamily: theme.fontSans, fontSize: 12 };
  const axisName = { color: theme.text.secondary, fontFamily: theme.fontSans, fontSize: 12 };

  return {
    animation: theme.animation,
    textStyle: { fontFamily: theme.fontSans },
    grid: { left: 56, right: 16, top: 16, bottom: 72 },
    tooltip: {
      ...tooltipBase(theme),
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgb(148 163 184 / 8%)' } },
      formatter: (
        params: { axisValue: string; seriesName: string; value: number; color: string }[],
      ) => {
        const rows = params
          .map((p) => `<div>${swatch(p.color)}${escapeHtml(p.seriesName)}: <b>${p.value}</b></div>`)
          .join('');
        const total = sum(params.map((p) => p.value));
        return `<div style="margin-bottom:4px"><b>${escapeHtml(params[0]?.axisValue ?? '')}</b> · ${total}</div>${rows}`;
      },
    },
    legend: { ...legendBase(theme), bottom: 0, left: 'center' },
    xAxis: {
      type: 'category',
      data: data.categories,
      name: labels.xAxis,
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: axisName,
      axisLine: { lineStyle: { color: theme.axis } },
      axisTick: { show: false },
      // Every category keeps a label; long names are truncated (full name in the tooltip).
      axisLabel: {
        ...axisLabel,
        interval: 0,
        ...(labelWidth > 0 ? { width: labelWidth, overflow: 'truncate' } : {}),
      },
    },
    yAxis: {
      type: 'value',
      name: labels.yAxis,
      nameLocation: 'middle',
      nameGap: 40,
      nameRotate: 90,
      nameTextStyle: axisName,
      minInterval: 1,
      axisLabel: { ...axisLabel, color: theme.text.muted },
      splitLine: { lineStyle: { color: theme.grid } },
    },
    series: data.series.map((series, s) => ({
      type: 'bar',
      name: series.label,
      stack: 'total',
      barMaxWidth: 36,
      itemStyle: {
        color: theme.status[series.tone],
        // 1px on each touching segment = 2px surface-colored gap between stacked segments.
        borderColor: theme.surface,
        borderWidth: 1,
      },
      emphasis: { focus: 'series' },
      data: series.values.map((value, c) => ({
        value,
        itemStyle: { borderRadius: tops[c] === s ? [4, 4, 0, 0] : 0 },
      })),
    })),
  };
}

export function columnBarSummary(heading: string, data: StackedBarVm): string {
  const parts = data.categories.map((category, c) => {
    const values = data.series.map((s) => `${s.values[c] ?? 0} ${s.label.toLowerCase()}`);
    return `${category}: ${values.join(', ')}`;
  });
  return `${heading}. ${parts.join('; ')}`;
}
