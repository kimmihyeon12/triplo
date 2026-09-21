import type { VisitSummary } from '../model/visit-stats';

/**
 * 화면이 보여주는 누적 방문 수.
 *
 * `totalPlaces`는 집계한 모든 장소·숙소이며 지역을 분류하지 못한 몫까지
 * 포함한다. 그 값을 그대로 쓰면 지도와 지역 목록의 합계보다 커져 같은
 * 화면 안에서 두 숫자가 어긋난다(2026-09-21 배너 99곳 대 통계 72곳).
 *
 * 그래서 지도에 실제로 올라간 몫만 센다. 분류하지 못한 수는 감추지 않고
 * 통계 화면 하단에 따로 적는다.
 */
export function mappedTotal(summary: VisitSummary): number {
  return summary.totalPlaces - summary.unclassifiedCount;
}
