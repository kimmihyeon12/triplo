import { NOTICE_CLASSES } from './notice.styles';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'div[appNotice]',
  templateUrl: './notice.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'classes',
    '[class.notice--warn]': "tone() === 'warn'",
    '[class.notice--danger]': "tone() === 'danger'",
    '[class.notice--ok]': "tone() === 'ok'",
  },
})
export class UiNotice {
  readonly classes = NOTICE_CLASSES;
  readonly tone = input<'warn' | 'danger' | 'ok' | null>(null);
}
