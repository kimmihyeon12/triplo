import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './spinner.html',
  host: { class: 'inline-flex shrink-0 items-center', 'aria-hidden': 'true' },
})
export class UiSpinner {}
