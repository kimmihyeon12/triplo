import { Injectable, inject } from '@angular/core';
import { todayIso } from '../../../shared/util/dates';
import { TRIP_REPOSITORY } from '../../trips/data/trip-repository';
import type { VisitFilter, VisitSummary, VisitedPlace } from '../model/visit-stats';
import { tallyDistricts, tallyVisits, visitedPlacesIn } from '../util/visit-tally';
import { visitSpots, type VisitSpot } from '../util/visit-spots';
import { savedMarkers } from '../util/saved-markers';
import type { VisitStatsRepository } from './visit-stats-repository';

/**
 * 로컬 여행을 읽어 브라우저에서 집계한다.
 *
 * 여행이 localStorage에 있는 동안은 전부 읽어 세어도 문제가 없다. 서버로
 * 옮긴 뒤에는 이 클래스 대신 집계 쿼리를 호출하는 구현을 끼운다. 화면은
 * 어느 쪽이든 같은 결과만 본다.
 */
@Injectable()
export class LocalVisitStats implements VisitStatsRepository {
  private readonly trips = inject(TRIP_REPOSITORY);

  async provinceCounts(filter: VisitFilter = 'all'): Promise<VisitSummary> {
    return tallyVisits(await this.trips.list(), todayIso(), filter);
  }

  async subRegionCounts(provinceCode: string): Promise<VisitSummary> {
    return tallyDistricts(await this.trips.list(), todayIso(), provinceCode);
  }

  async placesIn(regionCode: string, filter: VisitFilter = 'all'): Promise<VisitedPlace[]> {
    return visitedPlacesIn(await this.trips.list(), todayIso(), regionCode, filter);
  }

  /** 지도에 찍을 실제 방문 자리. 좌표가 저장된 장소에서만 낸다. */
  async spots(): Promise<VisitSpot[]> {
    return visitSpots(await this.trips.list(), todayIso());
  }

  /**
   * 방문 지도 한 번 로딩에 필요한 집계·저장 마커·방문 지점을 같은 여행 목록과 같은 기준
   * 날짜로 계산한다. 예전에는 셋이 각각 전체 여행을 읽어, 요청이 세 번 가고 그 사이에
   * 여행이 바뀌면 집계와 마커가 서로 다른 목록을 볼 수 있었다(리팩터링 제안 R4).
   */
  async mapSnapshot(filter: VisitFilter = 'all') {
    const trips = await this.trips.list();
    const today = todayIso();
    return {
      summary: tallyVisits(trips, today, filter),
      markers: savedMarkers(trips, filter),
      spots: visitSpots(trips, today),
    };
  }
}
