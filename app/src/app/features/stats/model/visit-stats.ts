import type { GeoPoint } from '../../places/model/place';
import type { IsoDate } from '../../trips/model/trip';

/** Uses saved itinerary kinds only, never inferred place categories. */
export type VisitFilter = 'all' | 'travel' | 'meal' | 'break';

/**
 * 통계 화면이 받는 값. 화면은 여행 본문을 절대 받지 않는다.
 *
 * 이 형태를 지키는 이유는 저장소 이전 때문이다. 지금은 브라우저가 로컬 여행을
 * 읽어 세지만, Supabase로 옮긴 뒤에는 서버가 집계 쿼리로 같은 형태를 돌려준다.
 * 화면이 여행 목록을 받으면 그 이전이 불가능해진다.
 */
export interface RegionVisitCount {
  /** 표준 지역 코드. 분류되지 않은 몫은 UNCLASSIFIED를 쓴다. */
  regionCode: string;
  name: string;
  visitCount: number;
}

export interface VisitedPlace {
  id: string;
  name: string;
  address: string;
  /** 소속 여행의 종료일. 실제 방문일이 아니라 방문으로 간주한 근거다. */
  visitedOn: IsoDate;
  /** 확인된 좌표. null이면 지도에 찍지 않고 목록에만 '위치 미확인'으로 둔다. */
  location: GeoPoint | null;
  tripId: string;
  tripTitle: string;
}

export interface VisitSummary {
  /** 방문 횟수가 많은 지역부터. 방문이 없는 지역은 들어 있지 않다. */
  regions: RegionVisitCount[];
  /** 집계한 장소 총 개수. 분류되지 않은 것도 포함한다. */
  totalPlaces: number;
  /** 표준 지역으로 분류하지 못한 장소 수. 감추지 않고 화면에 표시한다. */
  unclassifiedCount: number;
}
