import { booleanAttribute, ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/**
 * 라벨과 힌트까지 품은 체크박스. 화면마다 제각각이던 간격과 크기를 한곳에서 정한다.
 * 터치 영역을 확보하려고 label 전체를 44px 높이로 잡는다.
 */
@Component({
  selector: 'app-checkbox',
  templateUrl: './checkbox.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'checkbox-field block' },
})
export class UiCheckbox {
  readonly label = input.required<string>();
  readonly inputId = input.required<string>();
  readonly hint = input('');
  readonly name = input('');
  readonly testId = input('');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly checked = model(false);

  onToggle(event: Event): void {
    this.checked.set((event.target as HTMLInputElement).checked);
  }
}
