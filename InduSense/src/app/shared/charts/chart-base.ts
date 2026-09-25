import type { ChartTheme } from './chart-theme.service';

/** Tooltip formatters return HTML: every data-derived string must pass through this. */
export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Small square key for tooltip rows (identity comes from the swatch, text stays in text tokens). */
export function swatch(color: string): string {
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px;background:${escapeHtml(color)}"></span>`;
}

export function textStyle(theme: ChartTheme) {
  return { fontFamily: theme.fontSans, color: theme.text.secondary };
}

export function tooltipBase(theme: ChartTheme) {
  return {
    backgroundColor: theme.popover,
    borderColor: theme.axis,
    borderWidth: 1,
    padding: [8, 10],
    textStyle: { color: theme.text.primary, fontFamily: theme.fontSans, fontSize: 12 },
    extraCssText: 'border-radius:6px;box-shadow:0 8px 24px rgb(0 0 0 / 40%);',
    confine: true,
  };
}

export function legendBase(theme: ChartTheme) {
  return {
    icon: 'roundRect',
    itemWidth: 10,
    itemHeight: 10,
    itemGap: 12,
    textStyle: { color: theme.text.secondary, fontFamily: theme.fontSans, fontSize: 12 },
    inactiveColor: theme.text.muted,
  };
}

function luminance(color: string): number {
  const hex = color.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The ink (of the two text tokens given) with the higher contrast on a filled mark. */
export function readableInk(background: string, light: string, dark: string): string {
  return contrastRatio(light, background) >= contrastRatio(dark, background) ? light : dark;
}

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

/** `0.5` -> `50%`, rounding to whole percent except for small non-zero shares. */
export function percentLabel(value: number, total: number): string {
  if (total <= 0) {
    return '0%';
  }
  const pct = (value / total) * 100;
  return pct > 0 && pct < 1 ? '<1%' : `${Math.round(pct)}%`;
}
