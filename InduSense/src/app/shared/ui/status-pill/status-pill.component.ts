import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

import { StatusTone } from '../../utils/status-colors';

/** Rounded status badge: tinted background and colored text for the given tone. */
@Component({
  selector: 'app-status-pill',
  template: `
    @if (dot()) {
      <span class="pill__dot" aria-hidden="true"></span>
    }
    {{ label() }}
  `,
  styles: `
    :host {
      --pill-color: var(--status-stopped);
      --pill-text: var(--text-secondary);

      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 22px;
      padding: 0 10px;
      border-radius: var(--radius-pill);
      background: color-mix(in srgb, var(--pill-color) 20%, transparent);
      color: var(--pill-text);
      font-size: var(--fs-sm);
      font-weight: var(--fw-medium);
      line-height: 1;
      white-space: nowrap;
    }

    :host([data-tone='running']) {
      --pill-color: var(--status-running);
      --pill-text: var(--status-running);
    }

    :host([data-tone='warning']) {
      --pill-color: var(--status-warning);
      --pill-text: var(--status-warning);
    }

    :host([data-tone='fault']) {
      --pill-color: var(--status-fault);
      --pill-text: #f87171;
    }

    :host([data-tone='info']) {
      --pill-color: var(--accent-cyan);
      --pill-text: var(--accent-cyan);
    }

    .pill__dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--pill-color);
    }
  `,
  host: { '[attr.data-tone]': 'tone()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusPillComponent {
  readonly label = input.required<string>();
  readonly tone = input<StatusTone>('stopped');
  readonly dot = input(false, { transform: booleanAttribute });
}
