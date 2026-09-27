import { recordStatusLabel, recordStatusTone, toggledStatus } from './record-status';

describe('record status', () => {
  it('labels every status for people, never the raw value', () => {
    expect(recordStatusLabel('active')).toBe('Active');
    expect(recordStatusLabel('inactive')).toBe('Inactive');
    expect(recordStatusLabel('delete')).toBe('Deleted');
  });

  it('gives each status a distinct tone', () => {
    expect(recordStatusTone('active')).toBe('running');
    expect(recordStatusTone('inactive')).toBe('stopped');
    expect(recordStatusTone('delete')).toBe('fault');
  });

  it('toggles between active and inactive; a deleted record toggles back to active', () => {
    expect(toggledStatus('active')).toBe('inactive');
    expect(toggledStatus('inactive')).toBe('active');
    expect(toggledStatus('delete')).toBe('active');
  });
});
