import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { avatarTone } from '../../util/avatar-tone';

/**
 * 함께하는 사람 요약: 내 프로필 원과 나를 뺀 나머지 수의 회색 원(+N).
 * 여행 목록 카드와 상세에서 같은 모양으로 쓴다(2026-09-29 사용자 결정).
 * 글자는 화면 읽기용 이름표(label)로만 둔다. 이름 전체는 초대 화면 목록이 맡는다.
 */
@Component({
  selector: 'app-member-stack',
  templateUrl: './member-stack.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex flex-none items-center', role: 'img', '[attr.aria-label]': 'label()' },
})
export class UiMemberStack {
  readonly me = input.required<{ initial: string; seed: string }>();
  readonly others = input.required<number>();
  readonly label = input.required<string>();
  readonly tone = computed(() => avatarTone(this.me().seed));
}
