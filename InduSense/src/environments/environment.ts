import type { AppConfig } from '../app/core/config/app-config';

/** Production configuration. Replaced by `environment.development.ts` in development builds. */
export const environment: AppConfig = {
  appName: 'InduSense',
  production: true,
  apiBaseUrl: '/api/v1',
  refreshIntervalMs: 30_000,
  gauge: { label: 'watts', unit: 'W', min: 34, max: 45 },
};
