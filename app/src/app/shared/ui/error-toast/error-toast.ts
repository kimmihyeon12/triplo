import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon';

@Component({
  host: {
    class:
      'fixed [z-index:1000] [inset-inline:16px] [bottom:calc(24px_+_env(safe-area-inset-bottom,_0px)_+_var(--toast-bottom-offset,_0px))] [width:min(440px,_calc(100%_-_32px))] [margin-inline:auto]',
  },
  selector: 'app-error-toast',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './error-toast.html',
})
export class ErrorToast {
  readonly message = input.required<string>();
  readonly dismissed = output<void>();
}
