import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/**
 * Widget container. Header actions are projected with the `cardActions` attribute:
 * `<app-card heading="OEE"><button cardActions ...></button> ...body... </app-card>`
 */
@Component({
  selector: 'app-card',
  template: `
    @if (heading()) {
      <header class="card__header">
        <h2 class="card__title">{{ heading() }}</h2>
        <div class="card__actions"><ng-content select="[cardActions]" /></div>
      </header>
    }
    <div class="card__body" [class.card__body--padded]="padded()">
      <ng-content />
    </div>
  `,
  styleUrl: './card.component.scss',
  host: { '[class.card--interactive]': 'interactive()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardComponent {
  readonly heading = input<string>();
  readonly padded = input(true, { transform: booleanAttribute });
  readonly interactive = input(false, { transform: booleanAttribute });
}
