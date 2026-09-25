import { STATUS_TONE_VAR, statusLabel, statusTone } from './status-colors';

describe('statusTone', () => {
  it.each([
    ['RUNNING', 'running'],
    ['ONLINE', 'running'],
    ['IDLE', 'warning'],
    ['MAINTENANCE', 'warning'],
    ['FAULT', 'fault'],
    ['STOPPED', 'stopped'],
    ['OFFLINE', 'warning'],
    ['NEVER_SEEN', 'stopped'],
    ['UNKNOWN', 'stopped'],
  ])('maps %s to %s', (status, tone) => {
    expect(statusTone(status)).toBe(tone);
  });

  it('is case and separator insensitive', () => {
    expect(statusTone('running')).toBe('running');
    expect(statusTone(' never seen ')).toBe('stopped');
    expect(statusTone('never-seen')).toBe('stopped');
  });

  it('treats empty and unrecognised values as stopped', () => {
    expect(statusTone(null)).toBe('stopped');
    expect(statusTone(undefined)).toBe('stopped');
    expect(statusTone('')).toBe('stopped');
    expect(statusTone('SOMETHING_ELSE')).toBe('stopped');
  });

  it('has a CSS variable for every tone', () => {
    expect(STATUS_TONE_VAR.running).toBe('--status-running');
    expect(STATUS_TONE_VAR.fault).toBe('--status-fault');
  });
});

describe('statusLabel', () => {
  it('turns enum values into sentence case', () => {
    expect(statusLabel('RUNNING')).toBe('Running');
    expect(statusLabel('NEVER_SEEN')).toBe('Never seen');
    expect(statusLabel('maintenance')).toBe('Maintenance');
  });

  it('labels empty values as Unknown', () => {
    expect(statusLabel(null)).toBe('Unknown');
    expect(statusLabel('  ')).toBe('Unknown');
  });
});
