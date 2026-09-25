import type { ChartTheme } from '../../../../shared/charts/chart-theme.service';
import type { ChartOptions } from '../../../../shared/charts/echarts-setup';

export interface GaugeScale {
  min: number;
  max: number;
}

export type GaugeRange = 'below' | 'within' | 'above';

/** Guards against inverted or empty scales: max is always greater than min. */
export function normaliseScale(min: number, max: number): GaugeScale {
  const lo = Number.isFinite(min) ? min : 0;
  const hi = Number.isFinite(max) ? max : lo + 1;
  if (hi > lo) {
    return { min: lo, max: hi };
  }
  return hi < lo ? { min: hi, max: lo } : { min: lo, max: lo + 1 };
}

/** Needle position: the value clamped to the scale. */
export function clampGaugeValue(value: number, scale: GaugeScale): number {
  return Math.min(scale.max, Math.max(scale.min, value));
}

export function gaugeRange(value: number, scale: GaugeScale): GaugeRange {
  if (value < scale.min) {
    return 'below';
  }
  return value > scale.max ? 'above' : 'within';
}

export interface GaugeGeometry {
  /** Arc radius in px, or a percentage before the container has been measured. */
  radius: number | string;
  center: (number | string)[];
}

/** Largest semicircle that fits the container, pivot near the bottom edge. */
export function gaugeGeometry(size: { width: number; height: number }): GaugeGeometry {
  if (size.width <= 0 || size.height <= 0) {
    return { radius: '90%', center: ['50%', '90%'] };
  }
  const radius = Math.max(40, Math.min(size.width / 2 - 12, size.height - 16));
  return { radius, center: [size.width / 2, size.height - 6] };
}

/**
 * 180° sweep gauge. The arc's pivot sits near the bottom of the chart area; the numeric readout
 * and the min/max labels are rendered in HTML below it by the component.
 */
export function buildGaugeOptions(
  value: number,
  scale: GaugeScale,
  theme: ChartTheme,
  size: { width: number; height: number },
): ChartOptions {
  const { radius, center } = gaugeGeometry(size);

  return {
    animation: theme.animation,
    series: [
      {
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: scale.min,
        max: scale.max,
        radius,
        center,
        splitNumber: 5,
        progress: { show: true, width: 14, itemStyle: { color: theme.status.running } },
        axisLine: { lineStyle: { width: 14, color: [[1, theme.grid]] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: {
          length: '72%',
          width: 5,
          offsetCenter: [0, 0],
          itemStyle: { color: theme.accent.orange },
        },
        anchor: {
          show: true,
          size: 12,
          itemStyle: { color: theme.surface, borderColor: theme.accent.orange, borderWidth: 3 },
        },
        title: { show: false },
        detail: { show: false },
        data: [{ value: clampGaugeValue(value, scale) }],
      },
    ],
  };
}
