import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
} from '@angular/core';

import { ChartInstance, ChartOptions, echarts } from './echarts-setup';

export interface ChartSize {
  width: number;
  height: number;
}

/**
 * Renders an ECharts chart into the host element: `<div [appEchart]="options()"></div>`.
 * Browser only (initialised after the first render, never during SSR); follows option changes,
 * resizes with its container and is disposed with the view. The host needs a size from CSS.
 */
@Directive({
  selector: '[appEchart]',
  host: { class: 'echart' },
})
export class EchartDirective {
  readonly options = input.required<ChartOptions>({ alias: 'appEchart' });
  /** Container size after init and on every resize, for size-dependent options. */
  readonly sizeChange = output<ChartSize>();

  private chart: ChartInstance | null = null;

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    let observer: ResizeObserver | undefined;
    let frame = 0;

    afterNextRender(() => {
      this.chart = echarts.init(host, undefined, { renderer: 'svg' });
      this.chart.setOption(this.options(), { notMerge: true });
      this.sizeChange.emit({ width: host.clientWidth, height: host.clientHeight });

      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => {
            this.chart?.resize();
            this.sizeChange.emit({ width: host.clientWidth, height: host.clientHeight });
          });
        });
        observer.observe(host);
      }
    });

    effect(() => {
      const options = this.options();
      // Merge so updates animate from the previous state; series are replaced wholesale.
      this.chart?.setOption(options, { replaceMerge: ['series'] });
    });

    inject(DestroyRef).onDestroy(() => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      this.chart?.dispose();
      this.chart = null;
    });
  }
}
