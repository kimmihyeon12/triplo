import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { UiButton } from '../../../../shared/ui/button/button';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import type { DraftPreview } from '../../util/chat-draft';

/**
 * 변경을 적용하기 전에 무엇이 바뀌는지 보여주는 카드.
 *
 * AI가 말로 "버튼을 눌러 주세요"라고 안내하지 않는다. 말풍선 안에 실제 버튼이
 * 있는 카드를 띄우고, 바뀌기 전과 후를 나란히 보여준다. 기획안 20절의 'AI가
 * 단독으로 반영하지 않는다'는 규칙을 화면으로 옮긴 것이다.
 *
 * 내부 처리를 그대로 드러내지 않는다. 순서 교환을 'A ↔ B 추가 완료'처럼
 * 적으면 사용자는 무엇이 일어났는지 알 수 없다.
 */
@Component({
  selector: 'app-chat-confirm-card',
  templateUrl: './chat-confirm-card.html',
  imports: [UiButton, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class ChatConfirmCard {
  readonly preview = input.required<DraftPreview>();
  /** 이미 적용한 카드인지. 적용 뒤에는 되돌리기만 남긴다. */
  readonly applied = input(false);

  readonly confirm = output<void>();
  readonly dismiss = output<void>();
  readonly undo = output<void>();

  /**
   * 이동 거리 변화 문구. 줄어들 때만 말한다. 늘어나는 순서를 제안할 일은
   * 없고, 0.1km 미만의 차이는 오차 범위라 알릴 뜻이 없다.
   */
  readonly distanceText = computed<string | null>(() => {
    const delta = this.preview().distanceDeltaKm;
    if (delta === null || delta < 0.1) return null;
    return `이동 거리가 ${delta.toFixed(1)}km 줄어듭니다`;
  });

  /** 전후를 나란히 놓을지. 한쪽이 비면 나란히 둘 이유가 없다. */
  readonly showsComparison = computed(
    () => this.preview().before.length > 0,
  );
}
