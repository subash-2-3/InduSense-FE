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
import { CategorySliceVm } from '../../models/dashboard.vm';
import { WidgetCardComponent, WidgetContentDirective } from '../widget-card/widget-card.component';
import { buildPieOptions, pieSummary } from './pie-chart.options';

/** Solid pie of counts per category (W3 "Device Count by type"). */
@Component({
  selector: 'app-pie-chart-widget',
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
export class PieChartWidgetComponent {
  readonly heading = input.required<string>();
  readonly slices = input<CategorySliceVm[] | null>(null);
  readonly loading = input(false, { transform: booleanAttribute });
  readonly error = input<string | null>(null);
  readonly emptyMessage = input('Nothing to show yet.');

  readonly retry = output<void>();

  private readonly theme = inject(ChartThemeService).theme;
  protected readonly width = signal(0);

  protected readonly hasData = computed(() => !!this.slices()?.some((s) => s.value > 0));
  protected readonly options = computed(() =>
    buildPieOptions(this.slices() ?? [], this.theme, this.width() > 0 && this.width() < 360),
  );
  protected readonly summary = computed(() => pieSummary(this.heading(), this.slices() ?? []));
}
