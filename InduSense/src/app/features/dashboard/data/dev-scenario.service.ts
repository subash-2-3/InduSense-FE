import { Injectable, signal } from '@angular/core';

/**
 * Review scenarios for the mock data source, selected with `/dashboard?scenario=…` in development.
 * - normal: all widgets load
 * - loading: loads never finish (skeletons)
 * - empty: a plant with no devices or machines
 * - error: every widget fails
 * - partial: two widgets fail, the rest load
 * - flaky: every other load fails, so widgets keep their last data and show the stale marker
 */
export const DEV_SCENARIOS = ['normal', 'loading', 'empty', 'error', 'partial', 'flaky'] as const;

export type DevScenario = (typeof DEV_SCENARIOS)[number];

export function parseScenario(value: string | null | undefined): DevScenario {
  return DEV_SCENARIOS.find((s) => s === value) ?? 'normal';
}

@Injectable({ providedIn: 'root' })
export class DevScenarioService {
  readonly current = signal<DevScenario>('normal');
}
