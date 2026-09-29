/**
 * 지출 분류마다의 색. 요약 막대 조각, 필터 칩과 목록 라벨의 점이 같은 색을
 * 쓰므로 한곳에서 정한다. 라벨 자체는 분류와 상관없이 한 모양이다.
 *
 * Tailwind가 클래스를 찾을 수 있도록 조합하지 않은 전체 이름으로 적는다.
 */
export interface CategoryStyle {
  /** 막대 조각과 점의 채움. */
  readonly fill: string;
}

export const CATEGORY_STYLE: Record<string, CategoryStyle> = {
  food: { fill: 'bg-exp-food-bar' },
  stay: { fill: 'bg-exp-stay-bar' },
  transport: { fill: 'bg-exp-transport-bar' },
  activity: { fill: 'bg-exp-activity-bar' },
  shopping: { fill: 'bg-exp-shopping-bar' },
  other: { fill: 'bg-exp-other-bar' },
};

export function categoryStyle(key: string): CategoryStyle {
  return CATEGORY_STYLE[key] ?? CATEGORY_STYLE['other'];
}
