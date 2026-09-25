import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

import { StatusTone } from '../utils/status-colors';

/**
 * Categorical series colors, used in this fixed order and never cycled (more than 8 categories fold
 * into "Other"). Dark steps of the dataviz reference palette; validated on --bg-card (#111827):
 * worst adjacent CVD ΔE 8.4, normal-vision ΔE 19.3, all >= 3:1 contrast.
 */
export const CATEGORICAL_PALETTE = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
] as const;

export interface ChartTheme {
  surface: string;
  popover: string;
  grid: string;
  axis: string;
  text: { primary: string; secondary: string; muted: string };
  /** Dark ink for text on light or mid-tone fills (the app background color). */
  inkOnLight: string;
  fontSans: string;
  fontMono: string;
  status: Record<StatusTone, string>;
  categorical: readonly string[];
  accent: { cyan: string; orange: string };
  /** False when the viewer prefers reduced motion. */
  animation: boolean;
}

/** Token values from _tokens.scss; used on the server, in tests, or if a variable is missing. */
const FALLBACK = {
  '--bg-app': '#0b0f19',
  '--bg-card': '#111827',
  '--bg-popover': '#0f172a',
  '--border-card': '#1f293d',
  '--border-light': '#334155',
  '--text-primary': '#f8fafc',
  '--text-secondary': '#94a3b8',
  '--text-muted': '#8190a6',
  '--font-sans': "'Inter', system-ui, sans-serif",
  '--font-mono': "'JetBrains Mono', monospace",
  '--status-running': '#10b981',
  '--status-warning': '#f59e0b',
  '--status-fault': '#ef4444',
  '--status-stopped': '#64748b',
  '--accent-cyan': '#06b6d4',
  '--accent-orange': '#f97316',
} as const;

type Token = keyof typeof FALLBACK;

/**
 * Chart colors resolved from the CSS design tokens. ECharts renders with literal colors, so the
 * tokens are read once from the document (browser) and exposed as a plain object.
 */
@Injectable({ providedIn: 'root' })
export class ChartThemeService {
  readonly theme: ChartTheme;

  constructor() {
    const document = inject(DOCUMENT);
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    const view = isBrowser ? document.defaultView : null;
    const styles = view?.getComputedStyle(document.documentElement);
    const token = (name: Token) => styles?.getPropertyValue(name).trim() || FALLBACK[name];
    const reducedMotion = !!view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    this.theme = {
      surface: token('--bg-card'),
      popover: token('--bg-popover'),
      grid: token('--border-card'),
      axis: token('--border-light'),
      text: {
        primary: token('--text-primary'),
        secondary: token('--text-secondary'),
        muted: token('--text-muted'),
      },
      inkOnLight: token('--bg-app'),
      fontSans: token('--font-sans'),
      fontMono: token('--font-mono'),
      status: {
        running: token('--status-running'),
        warning: token('--status-warning'),
        fault: token('--status-fault'),
        stopped: token('--status-stopped'),
        info: token('--accent-cyan'),
      },
      categorical: CATEGORICAL_PALETTE,
      accent: { cyan: token('--accent-cyan'), orange: token('--accent-orange') },
      animation: !reducedMotion,
    };
  }
}
