import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icons';

@Component({
  selector: 'app-empty-state',
  imports: [IconComponent],
  template: `
    <span class="state__icon"><app-icon [name]="icon()" [size]="20" /></span>
    <p class="state__title">{{ heading() }}</p>
    @if (message()) {
      <p class="state__message" [attr.title]="compact() ? message() : null">{{ message() }}</p>
    }
    <ng-content />
  `,
  styleUrl: './state-message.scss',
  host: { role: 'status', '[class.state--compact]': 'compact()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  readonly heading = input('No data');
  readonly message = input<string>();
  /** Single-row layout for short containers. */
  readonly compact = input(false, { transform: booleanAttribute });
  readonly icon = input<IconName>('inbox');
}
