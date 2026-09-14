import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-field',
  templateUrl: './field.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'field flex flex-col gap-1 mb-4' },
})
export class UiField {
  readonly label = input.required<string>();
  readonly inputId = input.required<string>();
  readonly hint = input('');
}
