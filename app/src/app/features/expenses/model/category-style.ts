/**
 * 지출 분류마다의 색. 목록에서는 분류 라벨, 요약 막대와 필터 칩에서는
 * 점과 조각으로 같은 색 계열을 쓰므로 한곳에서 정한다.
 *
 * Tailwind가 클래스를 찾을 수 있도록 조합하지 않은 전체 이름으로 적는다.
 */
export interface CategoryStyle {
  /** 라벨의 바탕과 글자색. */
  readonly label: string;
  /** 막대 조각과 필터 점의 채움. 글자색보다 연한 톤이다. */
  readonly fill: string;
}

export const CATEGORY_STYLE: Record<string, CategoryStyle> = {
  food: {
    label: 'bg-exp-food-tint text-exp-food-ink',
    fill: 'bg-exp-food-bar',
  },
  stay: { label: 'bg-stay-tint text-stay-ink', fill: 'bg-exp-stay-bar' },
  transport: {
    label: 'bg-exp-transport-tint text-exp-transport-ink',
    fill: 'bg-exp-transport-bar',
  },
  activity: {
    label: 'bg-exp-activity-tint text-exp-activity-ink',
    fill: 'bg-exp-activity-bar',
  },
  shopping: {
    label: 'bg-exp-shopping-tint text-exp-shopping-ink',
    fill: 'bg-exp-shopping-bar',
  },
  other: {
    label: 'bg-exp-other-tint text-exp-other-ink',
    fill: 'bg-exp-other-bar',
  },
};

export function categoryStyle(key: string): CategoryStyle {
  return CATEGORY_STYLE[key] ?? CATEGORY_STYLE['other'];
}
