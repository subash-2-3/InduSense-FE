import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type SkeletonShape = 'text' | 'rect' | 'circle';

/** Shimmering placeholder shown while data loads. Purely decorative. */
@Component({
  selector: 'app-skeleton',
  template: '',
  styles: `
    :host {
      display: block;
      border-radius: var(--radius-sm);
      background: linear-gradient(
        90deg,
        var(--bg-card-hover) 25%,
        var(--border-light) 50%,
        var(--bg-card-hover) 75%
      );
      background-size: 200% 100%;
      animation: skeleton-shimmer 1.4s ease-in-out infinite;
    }

    :host([data-shape='text']) {
      height: 0.8em;
    }

    :host([data-shape='circle']) {
      border-radius: 50%;
    }

    @keyframes skeleton-shimmer {
      from {
        background-position: 100% 0;
      }
      to {
        background-position: -100% 0;
      }
    }
  `,
  host: {
    'aria-hidden': 'true',
    '[attr.data-shape]': 'shape()',
    '[style.width]': 'width()',
    '[style.height]': 'height()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonComponent {
  readonly shape = input<SkeletonShape>('text');
  readonly width = input('100%');
  /** Leave unset for `text` to follow the font size. */
  readonly height = input<string>();
}
