import { TestBed } from '@angular/core/testing';

import { ChartThemeService } from '../../../../shared/charts/chart-theme.service';
import {
  buildGaugeOptions,
  clampGaugeValue,
  gaugeGeometry,
  gaugeRange,
  normaliseScale,
} from './radial-gauge.options';

describe('radial gauge options', () => {
  const scale = { min: 34, max: 45 };

  it('clamps the needle to the scale', () => {
    expect(clampGaugeValue(40, scale)).toBe(40);
    expect(clampGaugeValue(2, scale)).toBe(34);
    expect(clampGaugeValue(99, scale)).toBe(45);
    expect(clampGaugeValue(34, scale)).toBe(34);
    expect(clampGaugeValue(45, scale)).toBe(45);
  });

  it('reports where the value lies relative to the scale', () => {
    expect(gaugeRange(2, scale)).toBe('below');
    expect(gaugeRange(34, scale)).toBe('within');
    expect(gaugeRange(45, scale)).toBe('within');
    expect(gaugeRange(45.1, scale)).toBe('above');
  });

  it('normalises inverted, empty and invalid scales', () => {
    expect(normaliseScale(34, 45)).toEqual({ min: 34, max: 45 });
    expect(normaliseScale(45, 34)).toEqual({ min: 34, max: 45 });
    expect(normaliseScale(10, 10)).toEqual({ min: 10, max: 11 });
    expect(normaliseScale(Number.NaN, Number.NaN)).toEqual({ min: 0, max: 1 });
  });

  it('fits the largest semicircle into the measured container', () => {
    expect(gaugeGeometry({ width: 0, height: 0 }).radius).toBe('90%');
    expect(gaugeGeometry({ width: 400, height: 150 })).toEqual({ radius: 134, center: [200, 144] });
    expect(gaugeGeometry({ width: 200, height: 300 }).radius).toBe(88);
    expect(gaugeGeometry({ width: 60, height: 30 }).radius).toBe(40);
  });

  it('plots the clamped value on a 180° sweep', () => {
    const { theme } = TestBed.inject(ChartThemeService);
    const options = buildGaugeOptions(2, scale, theme, { width: 400, height: 200 }) as {
      series: {
        startAngle: number;
        endAngle: number;
        min: number;
        max: number;
        data: { value: number }[];
        pointer: { itemStyle: { color: string } };
      }[];
    };
    const [series] = options.series;
    expect([series.startAngle, series.endAngle]).toEqual([180, 0]);
    expect([series.min, series.max]).toEqual([34, 45]);
    expect(series.data[0].value).toBe(34);
    expect(series.pointer.itemStyle.color).toBe(theme.accent.orange);
  });
});
