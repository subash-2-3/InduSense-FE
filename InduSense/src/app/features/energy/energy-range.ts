/**
 * Time range presets of the energy dashboard and reports. `from`/`to` are sent as UTC instants;
 * days start at the viewer's local midnight. "Today" sends nothing, so the backend uses today in
 * the plant's (else the company's) timezone.
 */

export type RangePreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export interface RangeOption {
  value: RangePreset;
  label: string;
}

export const RANGE_OPTIONS: readonly RangeOption[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom' },
];

export interface TimeRange {
  from?: string;
  to?: string;
}

/** A `<input type="datetime-local">` value (local time) as an ISO instant; undefined if empty/invalid. */
export function localInputToIso(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** A Date as a `<input type="datetime-local">` value in local time (`2026-09-27T08:30`). */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function startOfDay(date: Date, daysBack = 0): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysBack);
  return d;
}

/**
 * The range of a preset at `now`. `defaultToday` = false makes "today" explicit (reports default to
 * the last 7 days on the server otherwise).
 */
export function rangeFor(
  preset: RangePreset,
  now: Date,
  custom: { from?: string; to?: string } = {},
  defaultToday = true,
): TimeRange {
  switch (preset) {
    case 'today':
      return defaultToday ? {} : { from: startOfDay(now).toISOString(), to: now.toISOString() };
    case 'yesterday':
      return { from: startOfDay(now, 1).toISOString(), to: startOfDay(now).toISOString() };
    case 'week':
      return { from: startOfDay(now, 6).toISOString(), to: now.toISOString() };
    case 'month':
      return { from: startOfDay(now, 29).toISOString(), to: now.toISOString() };
    case 'custom':
      return { from: localInputToIso(custom.from), to: localInputToIso(custom.to) };
  }
}

/** Error to show for a custom range, or null when it can be requested. */
export function customRangeError(custom: { from?: string; to?: string }): string | null {
  const from = localInputToIso(custom.from);
  const to = localInputToIso(custom.to);
  if (!from) {
    return 'Choose a start date and time.';
  }
  if (to && to < from) {
    return 'The end must be after the start.';
  }
  return null;
}
