import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { PageBarState } from '../../../core/page-bar';
import { IconComponent } from '../icon/icon';
import { UiDismissible } from '../dismissible/dismissible';

@Component({
  selector: 'app-page-tools',
  templateUrl: './page-tools.html',
  imports: [RouterLink, IconComponent, UiDismissible],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageTools {
  readonly tools = input.required<NonNullable<PageBarState['tools']>>();
}
