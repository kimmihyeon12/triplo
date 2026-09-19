import { Injectable, inject } from '@angular/core';
import { todayIso } from '../../../shared/util/dates';
import { TRIP_REPOSITORY } from '../../trips/data/trip-repository';
import type { VisitFilter, VisitSummary, VisitedPlace } from '../model/visit-stats';
import { tallyDistricts, tallyVisits, visitedPlacesIn } from '../util/visit-tally';
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
}
