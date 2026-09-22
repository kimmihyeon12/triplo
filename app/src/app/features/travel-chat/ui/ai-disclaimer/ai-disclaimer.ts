import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import type { ReferenceNote } from '../../model/chat';

/**
 * 확인되지 않은 참고 정보를 확인된 사실과 구분해 보여준다.
 *
 * 영업시간·휴무·요금은 앱이 확인할 수 있는 출처가 없다. 그렇다고 아무 답도
 * 못 하면 물어볼 이유가 없어지므로, 답하되 확인되지 않았음을 눈에 띄게 적고
 * 직접 확인할 수 있는 링크를 함께 준다.
 *
 * 이 규칙은 챗봇만의 것이 아니라 영업정보를 보여주는 앱의 공통 규칙이다.
 * 다른 화면에서도 이 컴포넌트를 쓴다.
 */
@Component({
  selector: 'app-ai-disclaimer',
  templateUrl: './ai-disclaimer.html',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class AiDisclaimer {
  readonly note = input.required<ReferenceNote>();
}
