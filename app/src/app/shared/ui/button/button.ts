import { BUTTON_CLASSES } from './button.styles';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { UiSpinner } from '../spinner/spinner';

/** Keeps native button/form and anchor/router semantics, including keyboard activation. */
@Component({
  selector: 'button[appButton], a[appButton]',
  imports: [UiSpinner],
  templateUrl: './button.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'classes',
    '[class.btn--primary]': "variant() === 'primary'",
    '[class.btn--ghost]': "variant() === 'ghost'",
    '[class.btn--danger]': "variant() === 'danger'",
    '[class.btn--icon]': "variant() === 'icon'",
    '[attr.disabled]': 'disabled() || loading() ? "" : null',
    '[attr.aria-disabled]': 'disabled() || loading() ? "true" : null',
    '[attr.aria-busy]': 'loading() ? "true" : null',
  },
})
export class UiButton {
  readonly classes = BUTTON_CLASSES;
  readonly variant = input<'default' | 'primary' | 'ghost' | 'danger' | 'icon'>('default');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly loading = input(false, { transform: booleanAttribute });

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    // Capture before Angular chains RouterLink and template click handlers together.
    const guard = (event: Event) => {
      if (this.disabled() || this.loading()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    element.addEventListener('click', guard, { capture: true });
    inject(DestroyRef).onDestroy(() =>
      element.removeEventListener('click', guard, { capture: true }),
    );
  }
}
