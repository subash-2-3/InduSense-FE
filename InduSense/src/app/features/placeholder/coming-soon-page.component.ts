import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ButtonComponent, IconComponent, IconName } from '../../shared/ui';

/** Placeholder for sections not built yet. `section` and `icon` are bound from route data. */
@Component({
  selector: 'app-coming-soon-page',
  imports: [ButtonComponent, IconComponent, RouterLink],
  template: `
    <section class="soon" aria-labelledby="soon-title">
      <span class="soon__icon"><app-icon [name]="icon()" [size]="28" /></span>
      <h1 id="soon-title">{{ section() }}</h1>
      <p class="soon__text">This section is coming soon.</p>
      <a appButton routerLink="/dashboard">
        <app-icon name="gauge" [size]="16" />
        Back to Dashboard
      </a>
    </section>
  `,
  styles: `
    :host {
      display: grid;
      place-items: center;
      min-height: 100%;
      padding: var(--space-6) var(--space-4);
    }

    .soon {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      text-align: center;
    }

    .soon__icon {
      display: grid;
      place-items: center;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: var(--accent-cyan-soft);
      color: var(--accent-cyan);
    }

    .soon__text {
      color: var(--text-secondary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComingSoonPageComponent {
  readonly section = input('This page');
  readonly icon = input<IconName>('wand');
}
