import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EMPTY_STATE_CLASSES } from './empty-state.styles';

/**
 * 아무것도 없을 때 그 자리에 두는 안내.
 *
 * 전에는 화면마다 직접 만들어 열여덟 자리가 여섯 가지 모양이었다. 제목이
 * h2인 곳과 h3인 곳, 아이콘이 있는 곳과 없는 곳, 다음 행동을 알려 주는
 * 곳과 그냥 비었다고만 적은 곳이 섞여 있었다. 같은 '없음'인데 화면마다
 * 다르게 보이면 사용자는 그것이 다른 뜻이라고 읽는다.
 *
 * 제목 태그를 입력으로 받지 않는다. 문서 구조상 어느 수준에 놓일지는
 * 쓰는 쪽 사정이지만, 빈 상태는 어느 화면에서나 본문 안의 한 자리이므로
 * `p`로 두고 굵기로 위계를 준다. heading을 늘리면 화면의 목차가 실제
 * 구조와 어긋난다.
 *
 * 아이콘을 받지 않는다. 큰 빈칸에만 아이콘을 두게 했더니 같은 카드가
 * 화면에 따라 아이콘이 있기도 하고 없기도 해서 두 종류로 읽혔다.
 */
@Component({
  selector: 'app-empty-state',
  templateUrl: './empty-state.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes' },
})
export class UiEmptyState {
  readonly classes = EMPTY_STATE_CLASSES;

  /** 한 줄 제목. '아직 ~이 없어요' 형태로 적는다. */
  readonly title = input.required<string>();

  /** 왜 비었는지, 무엇을 하면 채워지는지. 한두 문장. */
  readonly hint = input<string>('');
}
