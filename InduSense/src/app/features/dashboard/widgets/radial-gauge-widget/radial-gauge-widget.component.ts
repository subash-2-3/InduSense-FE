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
import { ChartSize, EchartDirective } from '../../../../shared/charts/echart.directive';
import { IconComponent } from '../../../../shared/ui';
import { formatDateTime, formatNumber } from '../../../../shared/utils/format';
import { GaugeVm } from '../../models/dashboard.vm';
import { WidgetCardComponent, WidgetContentDirective } from '../widget-card/widget-card.component';
import {
  buildGaugeOptions,
  gaugeGeometry,
  gaugeRange,
  normaliseScale,
} from './radial-gauge.options';

/** 180° sweep gauge for one live reading (W7 "watts"). */
@Component({
  selector: 'app-radial-gauge-widget',
  imports: [EchartDirective, IconComponent, WidgetCardComponent, WidgetContentDirective],
  templateUrl: './radial-gauge-widget.component.html',
  styleUrl: './radial-gauge-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RadialGaugeWidgetComponent {
  readonly heading = input.required<string>();
  readonly gauge = input<GaugeVm | null>(null);
  readonly min = input.required<number>();
  readonly max = input.required<number>();
  readonly loading = input(false, { transform: booleanAttribute });
  readonly error = input<string | null>(null);

  readonly retry = output<void>();

  private readonly theme = inject(ChartThemeService).current;
  protected readonly size = signal<ChartSize>({ width: 0, height: 0 });

  protected readonly scale = computed(() => normaliseScale(this.min(), this.max()));
  protected readonly value = computed(() => this.gauge()?.value ?? null);
  protected readonly hasData = computed(() => this.value() !== null);
  protected readonly unit = computed(() => this.gauge()?.unit ?? '');

  protected readonly options = computed(() =>
    buildGaugeOptions(this.value() ?? this.scale().min, this.scale(), this.theme(), this.size()),
  );
  /** Width of the arc's base, so the min/max labels sit under its ends. */
  protected readonly arcWidth = computed(() => {
    const { radius } = gaugeGeometry(this.size());
    return typeof radius === 'number' ? radius * 2 + 14 : null;
  });
  protected readonly range = computed(() => gaugeRange(this.value() ?? 0, this.scale()));
  protected readonly readout = computed(() =>
    formatNumber(this.value(), { maximumFractionDigits: 1 }),
  );
  protected readonly readingTime = computed(() => {
    const ts = this.gauge()?.ts;
    return ts ? formatDateTime(ts) : null;
  });
  protected readonly summary = computed(() => {
    const { min, max } = this.scale();
    const outside = this.range() === 'within' ? '' : `, ${this.range()} range`;
    return `${this.heading()}: ${this.readout()} ${this.unit()} on a scale of ${min} to ${max}${outside}`;
  });

  protected format(value: number): string {
    return formatNumber(value, { maximumFractionDigits: 1 });
  }
}
