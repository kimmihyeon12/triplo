/**
 * 지출 분류마다의 색. 목록 라벨은 여행 상세의 분류 라벨과 같은 모양이며,
 * 식비·숙박은 여행 상세의 식사·숙소 라벨 색을 그대로 쓴다(2026-09-29 사용자
 * 결정). 요약 막대와 필터 점은 같은 색 계열의 중간 명도다.
 *
 * Tailwind가 클래스를 찾을 수 있도록 조합하지 않은 전체 이름으로 적는다.
 */
export interface CategoryStyle {
  /** 목록 라벨의 바탕과 글자색. */
  readonly label: string;
  /** 막대 조각과 필터 점의 채움. */
  readonly fill: string;
}

export const CATEGORY_STYLE: Record<string, CategoryStyle> = {
  food: { label: 'bg-meal-tint text-meal-ink', fill: 'bg-exp-food-bar' },
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
  other: { label: 'bg-exp-other-tint text-exp-other-ink', fill: 'bg-exp-other-bar' },
};

export function categoryStyle(key: string): CategoryStyle {
  return CATEGORY_STYLE[key] ?? CATEGORY_STYLE['other'];
}
