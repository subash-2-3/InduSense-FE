import { Directive, input, output } from '@angular/core';

import type { ChartSize } from '../../../shared/charts/echart.directive';
import type { ChartOptions } from '../../../shared/charts/echarts-setup';

/** Stand-in for EchartDirective in widget tests: records options instead of rendering. */
@Directive({ selector: '[appEchart]' })
export class FakeEchartDirective {
  readonly options = input.required<ChartOptions>({ alias: 'appEchart' });
  readonly sizeChange = output<ChartSize>();
}
