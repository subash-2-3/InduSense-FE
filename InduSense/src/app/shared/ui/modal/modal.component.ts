import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  booleanAttribute,
  input,
  output,
} from '@angular/core';

import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-modal',
  imports: [ButtonComponent, IconComponent],
  template: `
    @if (open()) {
      <div class="modal-backdrop" (click)="onBackdropClick($event)">
        <div
          class="modal-dialog"
          [style.max-width]="maxWidth()"
          role="dialog"
          aria-modal="true"
          (click)="$event.stopPropagation()"
        >
          <header class="modal-header">
            <div class="modal-titles">
              <h2 class="modal-title">{{ title() }}</h2>
              @if (subtitle()) {
                <p class="modal-subtitle">{{ subtitle() }}</p>
              }
            </div>
            <button
              appButton
              variant="icon"
              type="button"
              aria-label="Close dialog"
              (click)="close.emit()"
            >
              <app-icon name="x" [size]="18" />
            </button>
          </header>

          <div class="modal-body">
            <ng-content />
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: rgba(10, 15, 29, 0.75);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-4);
      animation: modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .modal-dialog {
      width: 100%;
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-lg, 12px);
      box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
      display: flex;
      flex-direction: column;
      max-height: calc(100vh - 48px);
      animation: modalSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      overflow: hidden;
    }

    .modal-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-5);
      border-bottom: 1px solid var(--border-light);
      background: rgba(255, 255, 255, 0.02);
    }

    .modal-title {
      font-size: var(--text-lg, 18px);
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .modal-subtitle {
      font-size: var(--text-xs, 12px);
      color: var(--text-secondary);
      margin: 4px 0 0;
    }

    .modal-body {
      padding: var(--space-5);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    @keyframes modalFadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes modalSlideUp {
      from {
        opacity: 0;
        transform: translateY(12px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalComponent {
  readonly open = input(false, { transform: booleanAttribute });
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly maxWidth = input('540px');

  readonly close = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) {
      this.close.emit();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }
}
