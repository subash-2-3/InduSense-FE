import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { ChartThemeService } from '../../../../shared/charts/chart-theme.service';
import { EchartDirective } from '../../../../shared/charts/echart.directive';
import { StatusSliceVm } from '../../models/dashboard.vm';
import { WidgetCardComponent, WidgetContentDirective } from '../widget-card/widget-card.component';
import { buildDonutOptions, donutSummary } from './donut-status.options';

/** Donut of counts per status with the total in the center (W4 "Device By Connection status"). */
@Component({
  selector: 'app-donut-status-widget',
  imports: [EchartDirective, WidgetCardComponent, WidgetContentDirective],
  template: `
    <app-widget-card
      [heading]="heading()"
      [hasData]="hasData()"
      [loading]="loading()"
      [error]="error()"
      [emptyMessage]="emptyMessage()"
      (retry)="retry.emit()"
    >
      <ng-template widgetContent>
        <div
          class="chart"
          role="img"
          [attr.aria-label]="summary()"
          [appEchart]="options()"
          (sizeChange)="width.set($event.width)"
        ></div>
      </ng-template>
    </app-widget-card>
  `,
  styleUrl: '../widget-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DonutStatusWidgetComponent {
  readonly heading = input.required<string>();
  readonly slices = input<StatusSliceVm[] | null>(null);
  readonly centerLabel = input('Devices count');
  readonly loading = input(false, { transform: booleanAttribute });
  readonly error = input<string | null>(null);
  readonly emptyMessage = input('Nothing to show yet.');

  readonly retry = output<void>();

  private readonly theme = inject(ChartThemeService).theme;
  protected readonly width = signal(0);

  protected readonly hasData = computed(() => !!this.slices()?.some((s) => s.value > 0));
  protected readonly options = computed(() =>
    buildDonutOptions(
      this.slices() ?? [],
      this.theme,
      this.centerLabel(),
      this.width() > 0 && this.width() < 360,
    ),
  );
  protected readonly summary = computed(() => donutSummary(this.heading(), this.slices() ?? []));
}
