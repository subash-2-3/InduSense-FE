import { TestBed } from '@angular/core/testing';

import { APP_CONFIG } from './app-config';

describe('APP_CONFIG', () => {
  it('resolves the environment configuration', () => {
    const config = TestBed.inject(APP_CONFIG);
    expect(config.appName).toBe('InduSense');
    expect(config.refreshIntervalMs).toBeGreaterThan(0);
    expect(config.gauge.max).toBeGreaterThan(config.gauge.min);
  });
});
