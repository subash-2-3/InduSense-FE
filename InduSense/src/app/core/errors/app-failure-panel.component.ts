import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ButtonComponent } from '../../shared/ui/button/button.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { AppFailureService } from './global-error-handler';

/**
 * Recovery panel for unexpected errors (`GlobalErrorHandler`). Not modal: the rest of the page may
 * still work, so the user can carry on, or reload to start clean.
 */
@Component({
  selector: 'app-failure-panel',
  imports: [ButtonComponent, IconComponent],
  template: `
    @if (failures.failure(); as f) {
      <section
        class="panel"
        role="alertdialog"
        aria-labelledby="app-failure-title"
        aria-describedby="app-failure-text"
      >
        <span class="panel__icon"><app-icon name="alert-triangle" [size]="18" /></span>
        <div class="panel__body">
          <h2 id="app-failure-title" class="panel__title">
            {{ f.message }}
            @if (f.count > 1) {
              <span class="panel__count">({{ f.count }} errors)</span>
            }
          </h2>
          <p id="app-failure-text" class="panel__text">
            @if (f.kind === 'update') {
              Reload to get the latest version. Unsaved changes on this page will be lost.
            } @else {
              The rest of the app may still work. Reload the page if something looks wrong.
            }
          </p>
          <div class="panel__actions">
            <button appButton variant="primary" size="sm" type="button" (click)="reload()">
              <app-icon name="refresh" [size]="14" /> Reload page
            </button>
            <button appButton variant="ghost" size="sm" type="button" (click)="failures.dismiss()">
              Dismiss
            </button>
          </div>
        </div>
      </section>
    }
  `,
  styles: `
    .panel {
      position: fixed;
      right: var(--space-4);
      bottom: var(--space-4);
      z-index: var(--z-toast);
      display: flex;
      gap: var(--space-3);
      max-width: min(420px, calc(100vw - 2 * var(--space-4)));
      padding: var(--space-4);
      border: 1px solid var(--status-fault);
      border-radius: var(--radius-md);
      background: var(--bg-popover);
      box-shadow: var(--shadow-popover);
      color: var(--text-primary);
    }
    .panel__icon {
      flex-shrink: 0;
      color: var(--status-fault-text);
    }
    .panel__title {
      margin: 0;
      font-size: var(--fs-sm);
      font-weight: var(--fw-semibold);
    }
    .panel__count {
      color: var(--text-secondary);
      font-weight: normal;
    }
    .panel__text {
      margin: var(--space-1) 0 var(--space-3);
      font-size: var(--fs-sm);
      color: var(--text-secondary);
    }
    .panel__actions {
      display: flex;
      gap: var(--space-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppFailurePanelComponent {
  protected readonly failures = inject(AppFailureService);
  private readonly document = inject(DOCUMENT);

  protected reload(): void {
    this.document.defaultView?.location.reload();
  }
}
