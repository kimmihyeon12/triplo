import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';

/**
 * 켜고 끄는 스위치.
 *
 * 체크박스와 다르다. 체크박스는 '고른다'는 뜻이고 폼을 보내야 반영되지만,
 * 스위치는 누르는 즉시 반영된다. 설정 목록처럼 바로 적용되는 자리에 쓴다.
 *
 * 줄 전체를 누르게 하려면 감싸는 쪽에서 button을 두고 이 컴포넌트를 표시
 * 전용으로 넣는다. 그때는 checked만 넘기고 changed는 쓰지 않는다.
 */
@Component({
  selector: 'app-switch',
  host: { class: 'inline-flex flex-none' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './switch.html',
})
export class UiSwitch {
  readonly checked = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  /** 읽기 전용 표시로 쓸 때 켠다. 바깥의 버튼이 조작을 맡는다. */
  readonly presentational = input(false, { transform: booleanAttribute });
  readonly label = input('');
  readonly changed = output<boolean>();

  toggle(): void {
    if (this.disabled()) return;
    this.changed.emit(!this.checked());
  }
}
