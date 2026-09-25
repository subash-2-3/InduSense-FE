import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';

import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icons';

@Component({
  selector: 'app-error-state',
  imports: [ButtonComponent, IconComponent],
  template: `
    <span class="state__icon state__icon--error"><app-icon [name]="icon()" [size]="20" /></span>
    <p class="state__title">{{ heading() }}</p>
    @if (message()) {
      <p class="state__message" [attr.title]="compact() ? message() : null">{{ message() }}</p>
    }
    @if (retryable()) {
      <button
        appButton
        type="button"
        size="sm"
        class="state__action"
        [loading]="retrying()"
        [disabled]="retrying()"
        (click)="retry.emit()"
      >
        <app-icon name="refresh" [size]="14" />
        {{ retryLabel() }}
      </button>
    }
  `,
  styleUrl: './state-message.scss',
  styles: `
    .state__icon--error {
      background: color-mix(in srgb, var(--status-fault) 15%, transparent);
      color: #f87171;
    }
  `,
  host: { role: 'alert', '[class.state--compact]': 'compact()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorStateComponent {
  readonly heading = input('Something went wrong');
  readonly message = input<string>();
  /** Single-row layout for short containers. */
  readonly compact = input(false, { transform: booleanAttribute });
  readonly icon = input<IconName>('alert-triangle');
  readonly retryable = input(true, { transform: booleanAttribute });
  readonly retryLabel = input('Retry');
  readonly retrying = input(false, { transform: booleanAttribute });

  readonly retry = output<void>();
}
