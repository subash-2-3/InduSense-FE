import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  TemplateRef,
  booleanAttribute,
  computed,
  contentChild,
  inject,
  input,
  output,
} from '@angular/core';

import {
  CardComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  IconComponent,
  SkeletonComponent,
} from '../../../../shared/ui';

/** Marks the widget body: `<ng-template widgetContent>…</ng-template>`. */
@Directive({ selector: 'ng-template[widgetContent]' })
export class WidgetContentDirective {
  readonly template = inject(TemplateRef);
}

/** Optional loading placeholder shaped like the widget: `<ng-template widgetSkeleton>`. */
@Directive({ selector: 'ng-template[widgetSkeleton]' })
export class WidgetSkeletonDirective {
  readonly template = inject(TemplateRef);
}

export type WidgetView = 'loading' | 'error' | 'empty' | 'ready';

/** Which view a widget shows. Data, once present, stays visible through refreshes and failures. */
export function widgetView(hasData: boolean, loading: boolean, error: string | null): WidgetView {
  if (hasData) {
    return 'ready';
  }
  if (loading) {
    return 'loading';
  }
  return error ? 'error' : 'empty';
}

/**
 * Card frame shared by all dashboard widgets. Renders exactly one of: skeleton, error (with
 * Retry), empty state or the content template. Templates are only instantiated when shown, so
 * charts initialise in a visible, sized container.
 */
@Component({
  selector: 'app-widget-card',
  imports: [
    CardComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    IconComponent,
    NgTemplateOutlet,
    SkeletonComponent,
  ],
  template: `
    <app-card [heading]="heading()" [padded]="padded()">
      @if (stale()) {
        <span
          cardActions
          class="widget__stale"
          role="img"
          aria-label="Refresh failed, showing the last loaded data"
          title="Refresh failed, showing the last loaded data"
        >
          <app-icon name="alert-triangle" [size]="14" />
        </span>
      }
      @switch (view()) {
        @case ('loading') {
          <div class="widget__state" aria-busy="true">
            <span class="sr-only">Loading {{ heading() }}</span>
            @if (skeleton(); as s) {
              <ng-container *ngTemplateOutlet="s.template" />
            } @else {
              <app-skeleton shape="rect" height="100%" class="widget__skeleton" />
            }
          </div>
        }
        @case ('error') {
          <app-error-state
            heading="Couldn't load data"
            [message]="error()!"
            [compact]="compact()"
            (retry)="retry.emit()"
          />
        }
        @case ('empty') {
          <app-empty-state
            [heading]="emptyHeading()"
            [message]="emptyMessage()"
            [compact]="compact()"
          />
        }
        @default {
          @if (content(); as c) {
            <ng-container *ngTemplateOutlet="c.template" />
          }
        }
      }
    </app-card>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
    }

    app-card {
      flex: 1 1 auto;
    }

    .widget__state {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-height: 0;
    }

    .widget__skeleton {
      flex: 1 1 auto;
      min-height: 80px;
    }

    .widget__stale {
      display: inline-flex;
      color: var(--status-warning);
    }
  `,
  host: { '[attr.aria-busy]': "loading() ? 'true' : null" },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetCardComponent {
  readonly heading = input.required<string>();
  readonly hasData = input(false, { transform: booleanAttribute });
  readonly loading = input(false, { transform: booleanAttribute });
  readonly error = input<string | null>(null);
  readonly emptyHeading = input('No data');
  readonly emptyMessage = input<string>();
  readonly padded = input(true, { transform: booleanAttribute });
  /** Single-row empty/error states, for short cards. */
  readonly compact = input(false, { transform: booleanAttribute });

  readonly retry = output<void>();

  protected readonly content = contentChild(WidgetContentDirective);
  protected readonly skeleton = contentChild(WidgetSkeletonDirective);

  readonly view = computed(() => widgetView(this.hasData(), this.loading(), this.error()));
  protected readonly stale = computed(() => this.hasData() && !!this.error());
}
