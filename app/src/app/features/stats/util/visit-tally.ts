import { REGION_LABEL, provinceCodeOf } from '../../../shared/util/korea-regions';
import type { GeoPoint } from '../../places/model/place';
import type { IsoDate, Trip, TripRegion } from '../../trips/model/trip';
import type { VisitFilter, VisitSummary, VisitedPlace } from '../model/visit-stats';
import { excludedReasons } from './excluded-reasons';
import { itemRegionCode } from './item-province';

/**
 * 표준 지역으로 분류하지 못한 몫의 키.
 *
 * 지역 코드는 '12_여수시' 꼴이므로 이 값과 겹치지 않는다.
 */
export const UNCLASSIFIED = '(분류되지 않음)';

/**
 * 여행 목록에서 지역별 방문 횟수를 센다.
 *
 * 세는 단위는 시·군·구다(2026-09-22 결정). 예전에는 시·도로 묶어서, 여수와
 * 구례에 다녀와도 '전남' 한 덩어리로만 보여 어디를 갔는지 알 수 없었다.
 *
 * 방문 판정은 여행 종료일이 오늘보다 이전인지로 한다(2026-09-18 결정).
 * 사용자가 직접 완료를 선언하는 기능이 아직 없어 날짜를 대신 쓴다. 이 값은
 * 저장하지 않고 화면을 열 때마다 계산한다.
 */
export function tallyVisits(trips: readonly Trip[], today: IsoDate, filter: VisitFilter = 'all'): VisitSummary {
  const summary = summarize(visitedItems(trips, today, filter), (item) => {
    // 주소를 먼저 읽는다. 한 여행에 여러 지역을 담으면 여행 지역만으로는
    // 장소마다 다른 실제 위치를 가릴 수 없다(util/item-province).
    const code = itemRegionCode(item.address, item.region);
    return code ? { code, name: REGION_LABEL[code] ?? code } : null;
  });
  // 화면이 비었을 때 까닭을 함께 넘긴다. 여행은 있는데 통계가 0이면
  // 사용자는 기록이 사라졌다고 오해한다.
  return { ...summary, excluded: excludedReasons(trips, today) };
}

/**
 * 한 시·도 안에서 시·군·구별 방문 횟수를 센다.
 *
 * 전국 지도가 이미 시·군·구 단위라 이 함수는 시·도 하나만 추려 보는 자리다.
 * 시·도 번호('12')를 받는다.
 */
export function tallyDistricts(
  trips: readonly Trip[],
  today: IsoDate,
  provinceCode: string,
): VisitSummary {
  return summarize(visitedItems(trips, today), (item) => {
    const code = itemRegionCode(item.address, item.region);
    if (!code || provinceCodeOf(code) !== provinceCode) return null;
    return { code, name: REGION_LABEL[code] ?? code };
  });
}

/**
 * 한 구역에서 방문한 장소 목록을 낸다.
 *
 * 시·군·구 코드('12_여수시')와 시·도 번호('12') 양쪽을 받는다. 시·도 번호를
 * 주면 그 안의 장소를 모두 낸다. 최근에 다녀온 것을 앞에 둔다.
 */
export function visitedPlacesIn(
  trips: readonly Trip[],
  today: IsoDate,
  regionCode: string,
  filter: VisitFilter = 'all',
): VisitedPlace[] {
  // '12'처럼 밑줄이 없으면 시·도 전체다.
  const isProvince = provinceCodeOf(regionCode) === regionCode;

  return visitedItems(trips, today, filter)
    .filter((item) => {
      // 집계와 같은 기준으로 고른다. 기준이 다르면 지도에 센 장소를 지역
      // 목록에서 볼 수 없다.
      const code = itemRegionCode(item.address, item.region);
      if (!code) return false;
      return isProvince ? provinceCodeOf(code) === regionCode : code === regionCode;
    })
    .map((item) => ({
      id: item.id,
      name: item.name,
      address: item.address,
      visitedOn: item.visitedOn,
      location: item.location,
      tripId: item.tripId,
      tripTitle: item.tripTitle,
    }))
    .sort((a, b) => b.visitedOn.localeCompare(a.visitedOn) || a.name.localeCompare(b.name, 'ko'));
}

/** 집계에 쓰는 한 항목. 장소와 숙소를 같은 모양으로 다룬다. */
interface VisitedItem {
  id: string;
  name: string;
  address: string;
  visitedOn: IsoDate;
  location: GeoPoint | null;
  tripId: string;
  tripTitle: string;
  /** 여행이 정의한 지역. 없으면 null */
  region: TripRegion | null;
}

/** 방문으로 셀 항목을 모두 모은다. */
function visitedItems(trips: readonly Trip[], today: IsoDate, filter: VisitFilter = 'all'): VisitedItem[] {
  const items: VisitedItem[] = [];

  for (const trip of trips) {
    if (!isVisited(trip, today)) continue;
    const regionById = new Map(trip.regions.map((r) => [r.id, r]));
    const base = { tripId: trip.id, tripTitle: trip.title, visitedOn: trip.endDate! };
    const regionOf = (id: string | null) => (id === null ? null : (regionById.get(id) ?? null));

    for (const stop of trip.stops) {
      // 제외한 장소는 가지 않은 것으로 본다. 여유시간은 장소가 아니다.
      if (stop.excluded || stop.kind === 'buffer') continue;
      if (filter !== 'all' && stop.kind !== (filter === 'travel' ? 'place' : filter)) continue;
      items.push({
        ...base,
        id: stop.id,
        name: stop.name,
        address: stop.address,
        location: stop.location,
        region: regionOf(stop.regionId),
      });
    }

    // 숙소는 실제로 머문 곳이므로 방문에서 뺄 이유가 없다.
    for (const stay of trip.stays) {
      if (filter !== 'all' && filter !== 'travel') continue;
      items.push({
        ...base,
        id: stay.id,
        name: stay.name,
        address: stay.address,
        location: stay.location,
        region: regionOf(stay.regionId),
      });
    }
  }

  return items;
}

/** 항목마다 키를 뽑아 개수를 센다. 키를 못 뽑은 몫은 분류되지 않음이 된다. */
function summarize(
  items: readonly VisitedItem[],
  keyOf: (item: VisitedItem) => { code: string; name: string } | null,
): VisitSummary {
  const counts = new Map<string, { name: string; visitCount: number }>();
  let unclassifiedCount = 0;

  for (const item of items) {
    const key = keyOf(item);
    if (!key) {
      unclassifiedCount += 1;
      continue;
    }
    const prev = counts.get(key.code);
    counts.set(key.code, { name: key.name, visitCount: (prev?.visitCount ?? 0) + 1 });
  }

  const regions = [...counts.entries()]
    .map(([regionCode, v]) => ({ regionCode, name: v.name, visitCount: v.visitCount }))
    // 많이 간 곳이 위로 온다. 같으면 이름 순으로 고정해 순서가 흔들리지 않게 한다.
    .sort((a, b) => b.visitCount - a.visitCount || a.name.localeCompare(b.name, 'ko'));

  return { regions, totalPlaces: items.length, unclassifiedCount };
}

/**
 * 여행이 끝났는지 본다. 종료일이 없으면 끝난 것으로 보지 않는다.
 *
 * 종료일이 오늘과 같은 날은 아직 여행 중이므로 세지 않는다.
 */
function isVisited(trip: Trip, today: IsoDate): boolean {
  return trip.endDate !== null && trip.endDate < today;
}
