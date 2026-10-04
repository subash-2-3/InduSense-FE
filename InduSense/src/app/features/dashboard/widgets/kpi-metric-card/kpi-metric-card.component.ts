import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';

import { IconComponent, IconName, SkeletonComponent } from '../../../../shared/ui';
import { formatNumber } from '../../../../shared/utils/format';
import { KpiVm } from '../../models/dashboard.vm';
import {
  WidgetCardComponent,
  WidgetContentDirective,
  WidgetSkeletonDirective,
} from '../widget-card/widget-card.component';

/** Single-number KPI (W1 "Devices", W2 "Device Types"): icon badge, value, subtitle. */
@Component({
  selector: 'app-kpi-metric-card',
  imports: [
    IconComponent,
    SkeletonComponent,
    WidgetCardComponent,
    WidgetContentDirective,
    WidgetSkeletonDirective,
  ],
  template: `
    <app-widget-card
      [heading]="heading()"
      [hasData]="!!kpi()"
      [loading]="loading()"
      [error]="error()"
      compact
      (retry)="retry.emit()"
    >
      <ng-template widgetSkeleton>
        <div class="kpi">
          <app-skeleton shape="circle" width="44px" height="44px" />
          <div class="kpi__text">
            <app-skeleton width="56px" height="30px" />
            <app-skeleton width="96px" />
          </div>
        </div>
      </ng-template>
      <ng-template widgetContent>
        <div class="kpi">
          <span class="kpi__badge"><app-icon [name]="icon()" [size]="22" /></span>
          <div class="kpi__text">
            <span class="kpi__value">{{ format(kpi()!.value) }}</span>
            <span class="kpi__subtitle">{{ subtitle() }}</span>
          </div>
        </div>
      </ng-template>
    </app-widget-card>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    app-widget-card {
      flex: 1 1 auto;
    }

    .kpi {
      display: flex;
      flex: 1 1 auto;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-1) 0;
    }

    .kpi__badge {
      display: grid;
      place-items: center;
      flex: none;
      width: 48px;
      height: 48px;
      border-radius: var(--radius-md);
      background: linear-gradient(135deg, var(--accent-cyan-soft), rgb(37 99 235 / 10%));
      border: 1px solid color-mix(in srgb, var(--accent-cyan) 30%, transparent);
      color: var(--accent-cyan);
      box-shadow: 0 2px 8px rgb(8 145 178 / 15%);
    }

    .kpi__text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .kpi__value {
      font-size: var(--fs-3xl);
      font-weight: var(--fw-bold);
      font-family: var(--font-mono);
      letter-spacing: -0.03em;
      line-height: 1;
      color: var(--text-primary);
    }

    .kpi__subtitle {
      color: var(--text-secondary);
      font-size: var(--fs-sm);
      font-weight: var(--fw-medium);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiMetricCardComponent {
  readonly heading = input.required<string>();
  readonly subtitle = input.required<string>();
  readonly icon = input<IconName>('router');
  readonly kpi = input<KpiVm | null>(null);
  readonly loading = input(false, { transform: booleanAttribute });
  readonly error = input<string | null>(null);

  readonly retry = output<void>();

  protected format(value: number): string {
    return formatNumber(value, { maximumFractionDigits: 0 });
  }
}
