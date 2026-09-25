import {
  EMPTY_VALUE,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelativeTime,
} from './format';

describe('formatDateTime', () => {
  it('formats as "MMM d, y hh:mm a"', () => {
    expect(formatDateTime('2026-07-27T16:25:00Z', { timeZone: 'UTC' })).toBe(
      'Jul 27, 2026 04:25 PM',
    );
    expect(formatDateTime('2026-03-06T09:05:00Z', { timeZone: 'UTC' })).toBe(
      'Mar 6, 2026 09:05 AM',
    );
  });

  it('accepts Date objects and epoch milliseconds', () => {
    const date = new Date('2026-01-01T00:00:00Z');
    expect(formatDateTime(date, { timeZone: 'UTC' })).toBe('Jan 1, 2026 12:00 AM');
    expect(formatDateTime(date.getTime(), { timeZone: 'UTC' })).toBe('Jan 1, 2026 12:00 AM');
  });

  it('renders missing or invalid values as an em dash', () => {
    expect(formatDateTime(null)).toBe(EMPTY_VALUE);
    expect(formatDateTime('')).toBe(EMPTY_VALUE);
    expect(formatDateTime('not a date')).toBe(EMPTY_VALUE);
  });
});

describe('formatNumber', () => {
  it('groups thousands and limits fraction digits', () => {
    expect(formatNumber(1234.5678)).toBe('1,234.57');
    expect(formatNumber(2)).toBe('2');
    expect(formatNumber(2, { minimumFractionDigits: 1 })).toBe('2.0');
  });

  it('renders missing and non-finite values as an em dash', () => {
    expect(formatNumber(null)).toBe(EMPTY_VALUE);
    expect(formatNumber(Number.NaN)).toBe(EMPTY_VALUE);
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe(EMPTY_VALUE);
  });
});

describe('formatPercent', () => {
  it('formats a 0..1 fraction', () => {
    expect(formatPercent(1)).toBe('100%');
    expect(formatPercent(0.256, 1)).toBe('25.6%');
    expect(formatPercent(null)).toBe(EMPTY_VALUE);
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-09-25T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it('uses the largest whole unit', () => {
    expect(formatRelativeTime(ago(2_000), now)).toBe('just now');
    expect(formatRelativeTime(ago(12_000), now)).toBe('12s ago');
    expect(formatRelativeTime(ago(5 * 60_000), now)).toBe('5m ago');
    expect(formatRelativeTime(ago(2 * 3_600_000), now)).toBe('2h ago');
    expect(formatRelativeTime(ago(3 * 86_400_000), now)).toBe('3d ago');
  });

  it('treats future times as just now', () => {
    expect(formatRelativeTime(new Date(now.getTime() + 10_000), now)).toBe('just now');
  });

  it('renders missing values as an em dash', () => {
    expect(formatRelativeTime(null, now)).toBe(EMPTY_VALUE);
  });
});
