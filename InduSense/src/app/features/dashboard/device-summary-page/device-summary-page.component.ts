import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { Permission } from '../../../core/auth/permissions';
import { APP_CONFIG } from '../../../core/config/app-config';
import {
  DashboardOption,
  DashboardToolbarComponent,
} from '../../../layout/dashboard-toolbar/dashboard-toolbar.component';
import { DashboardStore } from '../data/dashboard.store';
import { DEV_SCENARIOS, DevScenarioService, parseScenario } from '../data/dev-scenario.service';
import { ColumnBarWidgetComponent } from '../widgets/column-bar-widget/column-bar-widget.component';
import { DonutStatusWidgetComponent } from '../widgets/donut-status-widget/donut-status-widget.component';
import { KpiMetricCardComponent } from '../widgets/kpi-metric-card/kpi-metric-card.component';
import { MachineFleetTableComponent } from '../widgets/machine-fleet-table/machine-fleet-table.component';
import { NoAccessCardComponent } from '../widgets/no-access-card/no-access-card.component';
import { PieChartWidgetComponent } from '../widgets/pie-chart-widget/pie-chart-widget.component';
import { RadialGaugeWidgetComponent } from '../widgets/radial-gauge-widget/radial-gauge-widget.component';

/**
 * Device Summary dashboard: toolbar plus the 7 widgets, fed by DashboardStore (polling, manual
 * refresh, table paging). In development, `?scenario=` switches the mock data source's behaviour.
 */
@Component({
  selector: 'app-device-summary-page',
  imports: [
    ColumnBarWidgetComponent,
    DashboardToolbarComponent,
    DonutStatusWidgetComponent,
    KpiMetricCardComponent,
    MachineFleetTableComponent,
    NoAccessCardComponent,
    PieChartWidgetComponent,
    RadialGaugeWidgetComponent,
    RouterLink,
  ],
  templateUrl: './device-summary-page.component.html',
  styleUrl: './device-summary-page.component.scss',
  providers: [DashboardStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceSummaryPageComponent {
  /** `?scenario=` query parameter (development only). */
  readonly scenario = input<string>();

  protected readonly store = inject(DashboardStore);
  protected readonly config = inject(APP_CONFIG);
  private readonly devScenario = inject(DevScenarioService);
  private readonly auth = inject(AuthService);

  /** Which widget groups the signed-in user may see (the rest show a "No access" card). */
  protected readonly can = computed(() => {
    const has = (code: string) => this.auth.permissions().has(code);
    return {
      devices: has(Permission.DevicesView),
      machines: has(Permission.MachinesView),
      telemetry: has(Permission.TelemetryView) && has(Permission.TagsView),
    };
  });

  protected readonly dashboards: DashboardOption[] = [
    { id: 'device-summary', name: 'Device Summary' },
  ];
  protected readonly activeDashboard = 'device-summary';
  protected readonly scenarios = DEV_SCENARIOS;
  protected readonly activeScenario = this.devScenario.current.asReadonly();

  constructor() {
    if (!this.config.production) {
      effect(() => {
        const scenario = parseScenario(this.scenario());
        untracked(() => {
          if (scenario !== this.devScenario.current()) {
            this.devScenario.current.set(scenario);
            this.store.refresh();
          }
        });
      });
    }
    afterNextRender(() => this.store.start());
  }
}
