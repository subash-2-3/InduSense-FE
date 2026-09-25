/** Display formatting helpers. Every formatter renders missing or invalid values as an em dash. */

export const EMPTY_VALUE = '—';

type DateInput = Date | string | number | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface DateTimeFormatOptions {
  locale?: string;
  /** IANA time zone; defaults to the viewer's local zone. */
  timeZone?: string;
}

/** `Jul 27, 2026 04:25 PM` (pattern `MMM d, y hh:mm a`). */
export function formatDateTime(value: DateInput, options: DateTimeFormatOptions = {}): string {
  const date = toDate(value);
  if (!date) {
    return EMPTY_VALUE;
  }
  const parts = new Intl.DateTimeFormat(options.locale ?? 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: options.timeZone,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('month')} ${part('day')}, ${part('year')} ${part('hour')}:${part('minute')} ${part('dayPeriod').toUpperCase()}`;
}

export interface NumberFormatOptions {
  locale?: string;
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
}

export function formatNumber(
  value: number | null | undefined,
  options: NumberFormatOptions = {},
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return EMPTY_VALUE;
  }
  return new Intl.NumberFormat(options.locale ?? 'en-US', {
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
  }).format(value);
}

/** `fraction` is 0..1: `formatPercent(1)` -> `100%`. */
export function formatPercent(fraction: number | null | undefined, fractionDigits = 0): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) {
    return EMPTY_VALUE;
  }
  return `${(fraction * 100).toFixed(fractionDigits)}%`;
}

/** Short relative time for "updated … ago" labels: `just now`, `12s ago`, `5m ago`, `2h ago`, `3d ago`. */
export function formatRelativeTime(value: DateInput, now: DateInput = Date.now()): string {
  const date = toDate(value);
  const reference = toDate(now);
  if (!date || !reference) {
    return EMPTY_VALUE;
  }
  const seconds = Math.max(0, Math.floor((reference.getTime() - date.getTime()) / 1000));
  if (seconds < 5) {
    return 'just now';
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}
