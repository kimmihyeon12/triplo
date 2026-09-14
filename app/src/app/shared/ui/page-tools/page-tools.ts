import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { PageBarState } from '../../../core/page-bar';

@Component({
  selector: 'app-page-tools',
  templateUrl: './page-tools.html',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageTools {
  readonly tools = input.required<NonNullable<PageBarState['tools']>>();
}
