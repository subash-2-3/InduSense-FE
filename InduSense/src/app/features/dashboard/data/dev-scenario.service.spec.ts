import { DEV_SCENARIOS, parseScenario } from './dev-scenario.service';

describe('parseScenario', () => {
  it('accepts known scenarios and falls back to normal', () => {
    for (const scenario of DEV_SCENARIOS) {
      expect(parseScenario(scenario)).toBe(scenario);
    }
    expect(parseScenario(undefined)).toBe('normal');
    expect(parseScenario('ERROR')).toBe('normal');
    expect(parseScenario('<script>')).toBe('normal');
  });
});
