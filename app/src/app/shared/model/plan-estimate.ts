/** AI가 제안한 계획값. 장소 검색의 verified와 무관하며 공식 요금으로 승격하지 않는다. */
export interface PlanEstimate {
  cost: {
    min: number;
    max: number;
    basis: 'person' | 'group' | 'room_night';
    quantity: number;
    assumption: string;
  } | null;
  stay: { min: number; max: number; reason: string } | null;
}
