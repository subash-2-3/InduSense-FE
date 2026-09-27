import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { IconComponent } from '../icon/icon.component';
import { ToastService } from './toast.service';

/** Renders the ToastService queue in the bottom-right corner. Placed once, in the app root. */
@Component({
  selector: 'app-toast-container',
  imports: [IconComponent],
  template: `
    @for (toast of toasts(); track toast.id) {
      <div
        class="toast"
        [class.toast--error]="toast.type === 'error'"
        [attr.role]="toast.type === 'error' ? 'alert' : 'status'"
      >
        <app-icon
          class="toast__icon"
          [name]="toast.type === 'error' ? 'alert-triangle' : 'check'"
        />
        <span class="toast__message">{{ toast.message }}</span>
        <button
          class="toast__close"
          type="button"
          aria-label="Dismiss notification"
          (click)="dismiss(toast.id)"
        >
          <app-icon name="x" />
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      position: fixed;
      right: var(--space-4);
      bottom: var(--space-4);
      z-index: var(--z-toast);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      width: min(380px, calc(100vw - 2 * var(--space-4)));
      pointer-events: none;
    }

    .toast {
      --toast-color: var(--status-running);

      display: flex;
      align-items: flex-start;
      gap: var(--space-2);
      padding: var(--space-3);
      border: 1px solid var(--border-light);
      border-left: 3px solid var(--toast-color);
      border-radius: var(--radius-card);
      background: var(--bg-popover);
      box-shadow: var(--shadow-popover);
      color: var(--text-primary);
      font-size: var(--fs-md);
      line-height: var(--lh-base);
      pointer-events: auto;
    }

    .toast--error {
      --toast-color: var(--status-fault);
    }

    .toast__icon {
      flex: none;
      margin-top: 2px;
      color: var(--toast-color);
    }

    .toast__message {
      flex: 1;
      overflow-wrap: anywhere;
    }

    .toast__close {
      flex: none;
      padding: 2px;
      border: 0;
      border-radius: var(--radius-sm);
      background: none;
      color: var(--text-secondary);
      cursor: pointer;

      &:hover {
        color: var(--text-primary);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastContainerComponent {
  private readonly service = inject(ToastService);

  readonly toasts = this.service.toasts;

  dismiss(id: number): void {
    this.service.dismiss(id);
  }
}
