import { InjectionToken } from '@angular/core';
import type { VisitFilter, VisitSummary, VisitedPlace } from '../model/visit-stats';

/**
 * 통계 화면은 이 인터페이스만 사용한다.
 *
 * 여행 본문(`Trip`)을 화면에 넘기지 않는 것이 이 계약의 핵심이다. 지금은
 * localStorage 구현이 브라우저에서 세지만, Supabase로 옮긴 뒤에는 같은
 * 인터페이스의 서버 구현이 집계 쿼리 결과만 돌려준다. 화면이 여행 목록을
 * 받는 구조였다면 여행이 쌓였을 때 그 이전이 불가능해진다.
 */
export interface VisitStatsRepository {
  /** 시·도별 방문 횟수 */
  provinceCounts(filter?: VisitFilter): Promise<VisitSummary>;
  /** 한 시·도 안의 하위 구역별 방문 횟수. 하위 격자가 없으면 빈 결과 */
  subRegionCounts(provinceCode: string): Promise<VisitSummary>;
  /** 한 구역에서 방문한 장소 목록 */
  placesIn(regionCode: string, filter?: VisitFilter): Promise<VisitedPlace[]>;
}

export const VISIT_STATS_REPOSITORY = new InjectionToken<VisitStatsRepository>(
  'VISIT_STATS_REPOSITORY',
);
