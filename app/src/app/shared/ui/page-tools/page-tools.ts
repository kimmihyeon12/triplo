import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { PageBarState } from '../../../core/page-bar';
import { IconComponent } from '../icon/icon';
import { UiDismissible } from '../dismissible/dismissible';
import { avatarTone } from '../../util/avatar-tone';

@Component({
  selector: 'app-page-tools',
  templateUrl: './page-tools.html',
  imports: [RouterLink, IconComponent, UiDismissible],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageTools {
  /** 프로필 원 색. 사람마다 다르고 같은 사람은 늘 같다. */
  readonly tone = avatarTone;
  readonly tools = input.required<NonNullable<PageBarState['tools']>>();
}
