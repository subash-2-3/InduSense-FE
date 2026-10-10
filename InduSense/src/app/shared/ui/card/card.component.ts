import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  booleanAttribute,
  inject,
  input,
  signal,
} from '@angular/core';

import { IconComponent } from '../icon/icon.component';

/**
 * Widget container. Header actions are projected with the `cardActions` attribute:
 * `<app-card heading="OEE"><button cardActions ...></button> ...body... </app-card>`
 * Supports full card expand/minimize mode with Escape key and outside click listener.
 */
@Component({
  selector: 'app-card',
  imports: [IconComponent],
  template: `
    @if (heading()) {
      <header class="card__header">
        <h2 class="card__title">{{ heading() }}</h2>
        <div class="card__actions">
          <ng-content select="[cardActions]" />
          @if (expandable()) {
            <button
              type="button"
              class="card__expand-btn"
              [class.card__expand-btn--active]="isExpanded()"
              [attr.aria-label]="isExpanded() ? 'Minimize card' : 'Expand full card'"
              [title]="isExpanded() ? 'Minimize card (Esc)' : 'Expand full card'"
              (click)="toggleExpand($event)"
            >
              <app-icon [name]="isExpanded() ? 'minimize' : 'maximize'" [size]="14" />
            </button>
          }
        </div>
      </header>
    } @else if (expandable()) {
      <div class="card__actions card__actions--standalone">
        <ng-content select="[cardActions]" />
        <button
          type="button"
          class="card__expand-btn"
          [class.card__expand-btn--active]="isExpanded()"
          [attr.aria-label]="isExpanded() ? 'Minimize card' : 'Expand full card'"
          [title]="isExpanded() ? 'Minimize card (Esc)' : 'Expand full card'"
          (click)="toggleExpand($event)"
        >
          <app-icon [name]="isExpanded() ? 'minimize' : 'maximize'" [size]="14" />
        </button>
      </div>
    }
    <div class="card__body" [class.card__body--padded]="padded()">
      <ng-content />
    </div>
  `,
  styleUrl: './card.component.scss',
  host: {
    '[class.card--interactive]': 'interactive()',
    '[class.card--expanded]': 'isExpanded()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardComponent {
  readonly heading = input<string>();
  readonly padded = input(true, { transform: booleanAttribute });
  readonly interactive = input(false, { transform: booleanAttribute });
  readonly expandable = input(false, { transform: booleanAttribute });

  readonly isExpanded = signal(false);

  private readonly elementRef = inject(ElementRef);

  toggleExpand(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const next = !this.isExpanded();
    this.isExpanded.set(next);
    this.dispatchResize();
  }

  private dispatchResize(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('resize'));
      setTimeout(() => window.dispatchEvent(new Event('resize')), 80);
      setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isExpanded()) {
      this.isExpanded.set(false);
      this.dispatchResize();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isExpanded()) {
      const target = event.target as HTMLElement | null;
      if (target && !this.elementRef.nativeElement.contains(target)) {
        this.isExpanded.set(false);
        this.dispatchResize();
      }
    }
  }
}
