import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  booleanAttribute,
  computed,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';

import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';

type DrawerSize = 'md' | 'lg' | 'xl' | '2xl';

const WIDTHS: Record<DrawerSize, string> = {
  md: '28rem',
  lg: '34rem',
  xl: '42rem',
  '2xl': '48rem',
};

/**
 * Right-side drawer that slides in from the right edge.
 *
 * Unlike {@link ModalComponent} it has no dimming backdrop: the page and sidebar stay fully
 * visible and usable. It closes on Escape and on a pointer-down anywhere outside the panel — so
 * clicking a sidebar menu both closes the drawer and navigates. Pages keep the draft and the
 * open-state in sessionStorage (see `session-draft`), so the half-filled form comes back when the
 * user returns to that menu.
 */
@Component({
  selector: 'app-drawer',
  imports: [ButtonComponent, IconComponent],
  template: `
    @if (open()) {
      <div
        #panel
        class="drawer-panel"
        [style.max-width]="width()"
        role="dialog"
        aria-modal="false"
        [attr.aria-label]="title()"
      >
        <header class="drawer-header">
          <div class="drawer-titles">
            <h2 class="drawer-title">{{ title() }}</h2>
            @if (subtitle()) {
              <p class="drawer-subtitle">{{ subtitle() }}</p>
            }
          </div>
          <button
            appButton
            variant="icon"
            type="button"
            aria-label="Close"
            (click)="close.emit()"
          >
            <app-icon name="x" [size]="18" />
          </button>
        </header>

        <div class="drawer-body">
          <ng-content />
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .drawer-panel {
      position: fixed;
      top: 0;
      right: 0;
      z-index: 900;
      display: flex;
      height: 100vh;
      width: 100%;
      flex-direction: column;
      background: var(--bg-card);
      border-left: 1px solid var(--border-light);
      box-shadow: -8px 0 30px rgba(0, 0, 0, 0.25);
      animation: drawerSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .drawer-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-5);
      border-bottom: 1px solid var(--border-light);
      background: rgba(255, 255, 255, 0.02);
      flex-shrink: 0;
    }
    .drawer-title {
      font-size: var(--text-lg, 18px);
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }
    .drawer-subtitle {
      font-size: var(--text-xs, 12px);
      color: var(--text-secondary);
      margin: 4px 0 0;
    }
    .drawer-body {
      flex: 1;
      overflow-y: auto;
      padding: var(--space-5);
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    @keyframes drawerSlideIn {
      from {
        transform: translateX(100%);
      }
      to {
        transform: translateX(0);
      }
    }
    @media (max-width: 640px) {
      .drawer-panel {
        max-width: 100vw !important;
        width: 100vw;
        border-left: none;
      }
      .drawer-header {
        padding: var(--space-3) var(--space-4);
      }
      .drawer-body {
        padding: var(--space-4);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .drawer-panel {
        animation: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrawerComponent {
  readonly open = input(false, { transform: booleanAttribute });
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly size = input<DrawerSize>('lg');
  readonly closeOnOutsideClick = input(false, { transform: booleanAttribute });

  readonly close = output<void>();

  protected readonly width = computed(() => WIDTHS[this.size()] ?? WIDTHS.lg);

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  constructor() {
    effect((onCleanup) => {
      if (!this.open()) {
        return;
      }

      let removeListener: (() => void) | null = null;

      // Defer: the same pointer event that opened the drawer must not immediately close it, and
      // the panel needs to be in the DOM before we can focus it or test containment.
      const timer = setTimeout(() => {
        const el = this.panel()?.nativeElement;
        (
          el?.querySelector<HTMLElement>(
            'input, select, textarea, button:not([aria-label="Close"])',
          ) ?? el?.querySelector<HTMLElement>('button')
        )?.focus();

        if (this.closeOnOutsideClick()) {
          const onPointerDown = (event: PointerEvent) => {
            const panel = this.panel()?.nativeElement;
            if (panel && !panel.contains(event.target as Node)) {
              this.close.emit();
            }
          };
          document.addEventListener('pointerdown', onPointerDown, true);
          removeListener = () => document.removeEventListener('pointerdown', onPointerDown, true);
        }
      });

      onCleanup(() => {
        clearTimeout(timer);
        removeListener?.();
      });
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) {
      this.close.emit();
    }
  }
}
