import { ACTION_BAR_CLASSES } from './action-bar.styles';
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'div[appActionBar]',
  templateUrl: './action-bar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes' },
})
export class UiActionBar {
  readonly classes = ACTION_BAR_CLASSES;
}
