import type { IconName } from '../../../shared/ui/icon/icon';

/**
 * 지출 분류마다의 아이콘과 색. 분류는 모든 지출에 하나씩 붙는 이름표라
 * 상태 배지로 두지 않고 목록 왼쪽의 아이콘 타일로 보인다. 같은 색을 요약
 * 막대와 필터 칩 점에도 쓰므로 한곳에서 정한다.
 *
 * Tailwind가 클래스를 찾을 수 있도록 조합하지 않은 전체 이름으로 적는다.
 */
export interface CategoryStyle {
  readonly icon: IconName;
  /** 타일 바탕과 아이콘 색. */
  readonly tile: string;
  /** 분류 이름 글자색. */
  readonly ink: string;
  /** 막대 조각과 필터 점의 채움. 글자색보다 연한 톤이다. */
  readonly fill: string;
}

export const CATEGORY_STYLE: Record<string, CategoryStyle> = {
  food: {
    icon: 'meal',
    tile: 'bg-exp-food-tint text-exp-food-ink',
    ink: 'text-exp-food-ink',
    fill: 'bg-exp-food-bar',
  },
  stay: { icon: 'bed', tile: 'bg-stay-tint text-stay-ink', ink: 'text-stay-ink', fill: 'bg-exp-stay-bar' },
  transport: {
    icon: 'car',
    tile: 'bg-exp-transport-tint text-exp-transport-ink',
    ink: 'text-exp-transport-ink',
    fill: 'bg-exp-transport-bar',
  },
  activity: {
    icon: 'ticket',
    tile: 'bg-exp-activity-tint text-exp-activity-ink',
    ink: 'text-exp-activity-ink',
    fill: 'bg-exp-activity-bar',
  },
  shopping: {
    icon: 'bag',
    tile: 'bg-exp-shopping-tint text-exp-shopping-ink',
    ink: 'text-exp-shopping-ink',
    fill: 'bg-exp-shopping-bar',
  },
  other: {
    icon: 'wallet',
    tile: 'bg-exp-other-tint text-exp-other-ink',
    ink: 'text-exp-other-ink',
    fill: 'bg-exp-other-bar',
  },
};

export function categoryStyle(key: string): CategoryStyle {
  return CATEGORY_STYLE[key] ?? CATEGORY_STYLE['other'];
}
