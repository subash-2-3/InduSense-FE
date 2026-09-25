import {
  escapeHtml,
  legendBase,
  percentLabel,
  sum,
  swatch,
  tooltipBase,
} from '../../../../shared/charts/chart-base';
import type { ChartTheme } from '../../../../shared/charts/chart-theme.service';
import type { ChartOptions } from '../../../../shared/charts/echarts-setup';
import { formatNumber } from '../../../../shared/utils/format';
import { StatusSliceVm } from '../../models/dashboard.vm';

export function buildDonutOptions(
  slices: readonly StatusSliceVm[],
  theme: ChartTheme,
  centerLabel: string,
  compact: boolean,
): ChartOptions {
  const total = sum(slices.map((s) => s.value));
  const centerX = compact ? '50%' : '36%';
  const centerY = compact ? '42%' : '50%';
  const legendText = new Map(
    slices.map((s) => [s.label, `${s.label}  ${s.value} (${percentLabel(s.value, total)})`]),
  );

  return {
    animation: theme.animation,
    textStyle: { fontFamily: theme.fontSans },
    // Center readout: small label above the total.
    title: {
      text: centerLabel,
      subtext: formatNumber(total, { maximumFractionDigits: 0 }),
      left: centerX,
      top: centerY,
      textAlign: 'center',
      textVerticalAlign: 'middle',
      itemGap: 14,
      textStyle: { color: theme.text.secondary, fontSize: 12, fontWeight: 400 },
      subtextStyle: {
        color: theme.text.primary,
        fontSize: 28,
        fontWeight: 700,
        fontFamily: theme.fontSans,
      },
    },
    tooltip: {
      ...tooltipBase(theme),
      trigger: 'item',
      formatter: (p: { name: string; value: number; color: string }) =>
        `${swatch(p.color)}${escapeHtml(p.name)}: <b>${p.value}</b> (${percentLabel(p.value, total)})`,
    },
    legend: {
      ...legendBase(theme),
      orient: compact ? 'horizontal' : 'vertical',
      ...(compact ? { bottom: 0, left: 'center' } : { right: 8, top: 'middle' }),
      formatter: (name: string) => legendText.get(name) ?? name,
    },
    series: [
      {
        type: 'pie',
        radius: compact ? ['52%', '70%'] : ['65%', '85%'],
        center: [centerX, centerY],
        data: slices.map((s) => ({
          name: s.label,
          value: s.value,
          itemStyle: { color: theme.status[s.tone] },
        })),
        itemStyle: { borderColor: theme.surface, borderWidth: 2 },
        label: { show: false },
        labelLine: { show: false },
        emphasis: { scale: true, scaleSize: 3 },
      },
    ],
  };
}

export function donutSummary(heading: string, slices: readonly StatusSliceVm[]): string {
  const total = sum(slices.map((s) => s.value));
  const parts = slices.map((s) => `${s.label} ${s.value} (${percentLabel(s.value, total)})`);
  return `${heading}: ${total} in total. ${parts.join(', ')}`;
}
