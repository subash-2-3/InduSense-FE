import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'plain' | 'icon';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Themed button, applied as an attribute: `<button appButton variant="primary">`.
 * Consumers own `type` and `disabled`; `loading` only shows a spinner and sets aria-busy.
 */
@Component({
  selector: 'button[appButton], a[appButton]',
  template: `
    @if (loading()) {
      <span class="btn__spinner" aria-hidden="true"></span>
    }
    <ng-content />
  `,
  styleUrl: './button.component.scss',
  host: {
    class: 'btn',
    '[class.btn--primary]': "variant() === 'primary'",
    '[class.btn--secondary]': "variant() === 'secondary'",
    '[class.btn--ghost]': "variant() === 'ghost'",
    '[class.btn--plain]': "variant() === 'plain'",
    '[class.btn--icon]': "variant() === 'icon'",
    '[class.btn--sm]': "size() === 'sm'",
    '[class.btn--lg]': "size() === 'lg'",
    '[attr.aria-busy]': "loading() ? 'true' : null",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('secondary');
  readonly size = input<ButtonSize>('md');
  readonly loading = input(false, { transform: booleanAttribute });
}
