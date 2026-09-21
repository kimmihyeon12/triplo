import type { IsoDate, Trip } from '../../trips/model/trip';
import type { ExcludedReasons } from '../model/visit-stats';

/*
  집계에서 빠진 여행의 이유별 개수를 센다.

  화면이 비어 있을 때 "왜 안 잡히는지"를 알려 주기 위한 값이다. 이유를
  모르면 사용자는 기록이 사라졌다고 오해한다. 한 여행은 가장 먼저 걸린
  이유 하나에만 센다.

  각 항목의 뜻:
  - notEnded        종료일이 아직 지나지 않았다(오늘 포함)
  - noEndDate       종료일이 없어 끝났는지 판단할 수 없다
  - noRegion        담긴 장소·숙소에 지역이 하나도 연결되지 않았다
  - emptyItinerary  셀 수 있는 장소·숙소가 없다(제외 처리와 여유시간 제외)
*/

/**
 * 여행 목록에서 집계되지 않는 이유를 센다.
 *
 * 판정 순서는 visit-tally와 같다. 종료일을 먼저 보고, 끝난 여행만 일정
 * 내용을 확인한다. 이 순서가 달라지면 화면 안내가 실제 집계와 어긋난다.
 */
export function excludedReasons(trips: readonly Trip[], today: IsoDate): ExcludedReasons {
  const reasons: ExcludedReasons = { notEnded: 0, noEndDate: 0, noRegion: 0, emptyItinerary: 0 };

  for (const trip of trips) {
    if (trip.endDate === null) {
      reasons.noEndDate += 1;
      continue;
    }
    if (trip.endDate >= today) {
      reasons.notEnded += 1;
      continue;
    }

    // 여유시간은 장소가 아니고, 제외한 장소는 가지 않은 것으로 본다.
    const stops = trip.stops.filter((stop) => !stop.excluded && stop.kind !== 'buffer');
    const items = [...stops, ...trip.stays];
    if (!items.length) {
      reasons.emptyItinerary += 1;
      continue;
    }

    const known = new Set(trip.regions.map((region) => region.id));
    if (!items.some((item) => item.regionId !== null && known.has(item.regionId))) {
      reasons.noRegion += 1;
    }
  }

  return reasons;
}

/** 이유가 하나라도 있는지. 화면에서 안내를 띄울지 판단한다. */
export function hasExcluded(reasons: ExcludedReasons): boolean {
  return reasons.notEnded > 0 || reasons.noEndDate > 0
    || reasons.noRegion > 0 || reasons.emptyItinerary > 0;
}
