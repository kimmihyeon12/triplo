import {
  PROVINCE_SHORT_NAME,
  findRegionByName,
  provinceCodeOf,
} from '../../../shared/util/korea-regions';
import type { GeoPoint } from '../../places/model/place';
import type { IsoDate, Trip, TripRegion } from '../../trips/model/trip';
import { SEOUL_DISTRICT_NAME } from '../model/seoul-districts';
import type { VisitFilter, VisitSummary, VisitedPlace } from '../model/visit-stats';
import { districtCodeForAddress } from './district-match';

/**
 * 표준 지역으로 분류하지 못한 몫의 키.
 *
 * 지역 코드는 'gangwon-gangneung' 꼴이므로 이 값과 겹치지 않는다.
 */
export const UNCLASSIFIED = '(분류되지 않음)';

/**
 * 여행 목록에서 지역별 방문 횟수를 센다.
 *
 * 방문 판정은 여행 종료일이 오늘보다 이전인지로 한다(2026-09-18 결정).
 * 사용자가 직접 완료를 선언하는 기능이 아직 없어 날짜를 대신 쓴다. 이 값은
 * 저장하지 않고 화면을 열 때마다 계산한다.
 */
export function tallyVisits(trips: readonly Trip[], today: IsoDate, filter: VisitFilter = 'all'): VisitSummary {
  return summarize(visitedItems(trips, today, filter), (item) => {
    const resolved = resolveRegion(item.region);
    if (!resolved) return null;
    // 전국 격자는 시·도 단위다. 시·군 코드 그대로 세면 지도에서 찾지 못해
    // 모든 블록이 0회로 남는다. '강릉'과 '속초'는 함께 '강원'으로 센다.
    const code = provinceCodeOf(resolved.code);
    return { code, name: PROVINCE_SHORT_NAME[code] ?? resolved.name };
  });
}

/**
 * 한 시·도 안에서 하위 구역별 방문 횟수를 센다.
 *
 * 여행의 지역 목록은 광역시를 한 덩어리('서울')로만 담아서 구 단위 값이 없다.
 * 대신 이미 저장된 주소에서 자치구를 읽는다. 하위 격자가 없는 시·도는 빈
 * 결과를 내며, 화면은 그때 장소 목록만 보여준다.
 */
export function tallyDistricts(
  trips: readonly Trip[],
  today: IsoDate,
  provinceCode: string,
): VisitSummary {
  const inProvince = visitedItems(trips, today).filter((item) => {
    const resolved = resolveRegion(item.region);
    return resolved !== null && provinceCodeOf(resolved.code) === provinceCode;
  });

  return summarize(inProvince, (item) => {
    const code = districtCodeOf(item.address, provinceCode);
    return code ? { code, name: SEOUL_DISTRICT_NAME[code] ?? code } : null;
  });
}

/**
 * 한 구역에서 방문한 장소 목록을 낸다.
 *
 * 시·도 코드('gangwon-gangneung')와 자치구 코드('seoul-gangnam') 양쪽을 받는다.
 * 최근에 다녀온 것을 앞에 둔다.
 */
export function visitedPlacesIn(
  trips: readonly Trip[],
  today: IsoDate,
  regionCode: string,
  filter: VisitFilter = 'all',
): VisitedPlace[] {
  const provinceCode = provinceCodeOf(regionCode);
  const isDistrict = regionCode in SEOUL_DISTRICT_NAME;
  // 'gangwon'처럼 하이픈이 없으면 시·도 전체다. 전국 지도의 블록이 이 코드를 준다.
  const isProvince = !isDistrict && regionCode === provinceCode;

  return visitedItems(trips, today, filter)
    .filter((item) => {
      const resolved = resolveRegion(item.region);
      if (!resolved) return false;
      if (isProvince) return provinceCodeOf(resolved.code) === provinceCode;
      if (!isDistrict) return resolved.code === regionCode;
      return (
        provinceCodeOf(resolved.code) === provinceCode &&
        districtCodeOf(item.address, provinceCode) === regionCode
      );
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

/** 주소에서 하위 구역 코드를 읽는다. 하위 격자가 있는 시·도만 값이 나온다. */
function districtCodeOf(address: string, provinceCode: string): string | null {
  return provinceCode === 'seoul' ? districtCodeForAddress(address) : null;
}

/**
 * 여행의 지역을 표준 지역 코드로 바꾼다.
 *
 * 저장된 코드를 먼저 쓰고, 없으면 이름으로 찾는다. 이름은 고정 목록에서 고른
 * 값이므로 대부분 찾아진다. 둘 다 실패하면 null이며 '분류되지 않음'이 된다.
 */
function resolveRegion(region: TripRegion | null): { code: string; name: string } | null {
  if (!region) return null;
  if (region.regionCode) return { code: region.regionCode, name: region.name };
  const found = findRegionByName(region.name);
  return found ? { code: found.code, name: found.name } : null;
}
