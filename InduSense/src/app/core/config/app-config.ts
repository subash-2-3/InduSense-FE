import { InjectionToken } from '@angular/core';

import { environment } from '../../../environments/environment';

/** Scale and labelling of the dashboard's radial gauge widget (W7). */
export interface GaugeConfig {
  label: string;
  unit: string;
  min: number;
  max: number;
}

export interface AppConfig {
  appName: string;
  production: boolean;
  /** Base URL of the InduSense API. Not used until the integration track (Phase 6). */
  apiBaseUrl: string;
  /** Dashboard polling interval. */
  refreshIntervalMs: number;
  gauge: GaugeConfig;
}

/** Runtime configuration, resolved from the active `environment` file. */
export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG', {
  providedIn: 'root',
  factory: () => environment,
});
