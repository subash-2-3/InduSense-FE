import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

import { CardComponent, EmptyStateComponent } from '../../../../shared/ui';

/** Stands in for a widget the signed-in user has no permission to see (keeps the grid intact). */
@Component({
  selector: 'app-no-access-card',
  imports: [CardComponent, EmptyStateComponent],
  template: `
    <app-card [heading]="heading()">
      <app-empty-state
        icon="lock"
        heading="No access"
        message="Your role doesn't include this data."
        [compact]="compact()"
      />
    </app-card>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    app-card {
      flex: 1 1 auto;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoAccessCardComponent {
  readonly heading = input.required<string>();
  readonly compact = input(false, { transform: booleanAttribute });
}
