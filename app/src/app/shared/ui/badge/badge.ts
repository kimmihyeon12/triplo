import { BADGE_CLASSES } from './badge.styles';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'span[appBadge]',
  templateUrl: './badge.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'classes',
    '[class.cell--accent]': "tone() === 'accent'",
    '[class.cell--stay]': "tone() === 'stay'",
    '[class.cell--warn]': "tone() === 'warn'",
    '[class.cell--danger]': "tone() === 'danger'",
    '[class.cell--ok]': "tone() === 'ok'",
    '[class.cell--ghost]': "tone() === 'neutral'",
  },
})
export class UiBadge {
  readonly classes = BADGE_CLASSES;
  readonly tone = input<'accent' | 'stay' | 'warn' | 'danger' | 'ok' | 'neutral' | null>(null);
}
