import { UiBadge } from '../badge/badge';
import { IconComponent } from '../icon/icon';
import { memoParts } from '../../util/memo-parts';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * 일정 항목의 메모. 'AI 추정' 목록은 아이콘을 단 라벨 아래에 묶는다. 예상 금액은 부르는 쪽이 원래 자리에 둔다.
 * 사용자가 쓴 글은 목록 아래에 평소처럼 보인다(2026-10-02 사용자 결정: 회색 칸 없이 'AI 추정' 라벨, '-' 목록 유지).
 */
@Component({
  selector: 'app-memo',
  imports: [UiBadge, IconComponent],
  templateUrl: './memo.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-1.5' },
})
export class UiMemo {
  readonly memo = input<string | null | undefined>('');
  readonly parts = computed(() => memoParts(this.memo()));
}
