import { customRangeError, localInputToIso, rangeFor, toLocalInput } from './energy-range';

describe('energy time ranges', () => {
  const now = new Date(2026, 8, 27, 14, 30); // 27 Sep 2026 14:30 local

  it('leaves "today" to the server unless asked to be explicit', () => {
    expect(rangeFor('today', now)).toEqual({});
    expect(rangeFor('today', now, {}, false)).toEqual({
      from: new Date(2026, 8, 27).toISOString(),
      to: now.toISOString(),
    });
  });

  it('computes yesterday, the last 7 and the last 30 days from local midnight', () => {
    expect(rangeFor('yesterday', now)).toEqual({
      from: new Date(2026, 8, 26).toISOString(),
      to: new Date(2026, 8, 27).toISOString(),
    });
    expect(rangeFor('week', now).from).toBe(new Date(2026, 8, 21).toISOString());
    expect(rangeFor('month', now).from).toBe(new Date(2026, 7, 29).toISOString());
    expect(rangeFor('month', now).to).toBe(now.toISOString());
  });

  it('turns custom local inputs into instants', () => {
    const custom = { from: '2026-09-01T00:00', to: '2026-09-02T12:00' };
    expect(rangeFor('custom', now, custom)).toEqual({
      from: new Date(2026, 8, 1).toISOString(),
      to: new Date(2026, 8, 2, 12).toISOString(),
    });
    expect(localInputToIso('')).toBeUndefined();
    expect(localInputToIso('not a date')).toBeUndefined();
    expect(toLocalInput(new Date(2026, 0, 5, 7, 3))).toBe('2026-01-05T07:03');
  });

  it('validates a custom range', () => {
    expect(customRangeError({ to: '2026-09-02T00:00' })).toBe('Choose a start date and time.');
    expect(customRangeError({ from: '2026-09-02T00:00', to: '2026-09-01T00:00' })).toBe(
      'The end must be after the start.',
    );
    expect(customRangeError({ from: '2026-09-01T00:00' })).toBeNull();
  });
});
