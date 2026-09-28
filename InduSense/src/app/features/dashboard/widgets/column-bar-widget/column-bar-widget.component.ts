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
import { StackedBarVm } from '../../models/dashboard.vm';
import { WidgetCardComponent, WidgetContentDirective } from '../widget-card/widget-card.component';
import { buildColumnBarOptions, columnBarSummary } from './column-bar.options';

/** Stacked columns per category and status (W5 "Devices by Connection type and Status"). */
@Component({
  selector: 'app-column-bar-widget',
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
export class ColumnBarWidgetComponent {
  readonly heading = input.required<string>();
  readonly data = input<StackedBarVm | null>(null);
  readonly xAxisLabel = input('Device Connectivity');
  readonly yAxisLabel = input('Devices count');
  readonly loading = input(false, { transform: booleanAttribute });
  readonly error = input<string | null>(null);
  readonly emptyMessage = input('Nothing to show yet.');

  readonly retry = output<void>();

  private readonly theme = inject(ChartThemeService).current;
  protected readonly width = signal(0);

  protected readonly hasData = computed(
    () => !!this.data()?.series.some((s) => s.values.some((v) => v > 0)),
  );
  protected readonly options = computed(() =>
    buildColumnBarOptions(
      this.data() ?? { categories: [], series: [] },
      this.theme(),
      { xAxis: this.xAxisLabel(), yAxis: this.yAxisLabel() },
      this.width(),
    ),
  );
  protected readonly summary = computed(() =>
    columnBarSummary(this.heading(), this.data() ?? { categories: [], series: [] }),
  );
}
