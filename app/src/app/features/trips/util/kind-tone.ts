import type { BadgeTone } from '../../../shared/util/badge-tone';
import type { StopKind } from '../model/trip';

/**
 * 분류 배지의 색. 순번 원은 모두 같은 색이므로 종류는 이 배지가 알린다.
 * 하루 일정에서 '밥 먹는 곳'과 '구경하는 곳'을 눈으로 가를 수 있어야 한다.
 *
 * 다른 뜻으로 이미 쓰는 색은 빌려 쓰지 않는다. ok는 확인됨·완료를, stay는
 * 숙소를, warn은 위치 미확인을 뜻한다. 그래서 식사와 카페에는 분류 전용으로
 * 만든 색을 쓴다.
 */
export function kindTone(kind: StopKind): BadgeTone {
  switch (kind) {
    case 'place':
      return 'place';
    case 'meal':
      return 'meal';
    case 'break':
      return 'cafe';
    default:
      return 'neutral';
  }
}
