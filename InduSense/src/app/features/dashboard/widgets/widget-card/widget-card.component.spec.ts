import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  WidgetCardComponent,
  WidgetContentDirective,
  WidgetSkeletonDirective,
  widgetView,
} from './widget-card.component';

describe('widgetView', () => {
  it('keeps data visible through refreshes and failures', () => {
    expect(widgetView(true, false, null)).toBe('ready');
    expect(widgetView(true, true, null)).toBe('ready');
    expect(widgetView(true, false, 'boom')).toBe('ready');
  });

  it('shows loading, then error, then empty when there is no data', () => {
    expect(widgetView(false, true, null)).toBe('loading');
    expect(widgetView(false, true, 'boom')).toBe('loading');
    expect(widgetView(false, false, 'boom')).toBe('error');
    expect(widgetView(false, false, null)).toBe('empty');
  });
});

@Component({
  imports: [WidgetCardComponent, WidgetContentDirective, WidgetSkeletonDirective],
  template: `
    <app-widget-card
      heading="Devices"
      emptyHeading="Nothing"
      [hasData]="hasData()"
      [loading]="loading()"
      [error]="error()"
      (retry)="retries = retries + 1"
    >
      <ng-template widgetSkeleton><p class="custom-skeleton">skeleton</p></ng-template>
      <ng-template widgetContent><p class="content">content</p></ng-template>
    </app-widget-card>
  `,
})
class HostComponent {
  readonly hasData = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  retries = 0;
}

describe('WidgetCardComponent', () => {
  async function setup(state: Partial<{ hasData: boolean; loading: boolean; error: string }>) {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.hasData.set(state.hasData ?? false);
    fixture.componentInstance.loading.set(state.loading ?? false);
    fixture.componentInstance.error.set(state.error ?? null);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('renders the content template only when there is data', async () => {
    const { el } = await setup({ hasData: true });
    expect(el.querySelector('h2')?.textContent).toBe('Devices');
    expect(el.querySelector('.content')).not.toBeNull();
    expect(el.querySelector('app-error-state, app-empty-state, .custom-skeleton')).toBeNull();
  });

  it('renders the custom skeleton while loading and marks the widget busy', async () => {
    const { el } = await setup({ loading: true });
    expect(el.querySelector('.custom-skeleton')).not.toBeNull();
    expect(el.querySelector('.content')).toBeNull();
    expect(el.querySelector('app-widget-card')?.getAttribute('aria-busy')).toBe('true');
    expect(el.querySelector('.sr-only')?.textContent).toBe('Loading Devices');
  });

  it('renders the error with a working Retry', async () => {
    const { fixture, el } = await setup({ error: 'Server down' });
    expect(el.querySelector('app-error-state .state__message')?.textContent).toBe('Server down');
    el.querySelector<HTMLButtonElement>('app-error-state button')!.click();
    expect(fixture.componentInstance.retries).toBe(1);
  });

  it('renders the empty state', async () => {
    const { el } = await setup({});
    expect(el.querySelector('app-empty-state .state__title')?.textContent).toBe('Nothing');
  });

  it('flags stale data after a failed refresh', async () => {
    const { el } = await setup({ hasData: true, error: 'Server down' });
    expect(el.querySelector('.content')).not.toBeNull();
    expect(el.querySelector('.widget__stale')?.getAttribute('aria-label')).toContain(
      'Refresh failed',
    );
  });
});
