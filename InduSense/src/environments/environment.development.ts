import type { AppConfig } from '../app/core/config/app-config';

export const environment: AppConfig = {
  appName: 'InduSense',
  production: false,
  apiBaseUrl: '/api/v1',
  refreshIntervalMs: 30_000,
  gauge: { label: 'watts', unit: 'W', min: 34, max: 45 },
};
