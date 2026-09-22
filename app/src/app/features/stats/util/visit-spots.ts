import { REGION_LABEL } from '../../../shared/util/korea-regions';
import type { GeoPoint } from '../../places/model/place';
import type { IsoDate, Trip } from '../../trips/model/trip';
import { itemRegionCode } from './item-province';

/** 지도에 찍을 방문 자리 하나. 같은 행정구역의 장소는 한 자리로 모인다. */
export interface VisitSpot {
  /** 이 자리의 시·군·구 코드. 색 단계와 지역 목록은 이 값을 쓴다. */
  regionCode: string;
  /** 마커에 적을 이름. 시·군·구 이름이다. 예: '여수시' */
  name: string;
  /** 모인 장소들의 평균 좌표. 저장된 값에서만 낸다. */
  location: GeoPoint;
  /** 이 자리에 모인 장소 수. 높이와 색의 진하기를 정한다. */
  count: number;
}

function usable(p: GeoPoint | null): p is GeoPoint {
  return (
    p !== null &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
}

/**
 * 여행에서 실제로 다녀온 자리를 뽑는다.
 *
 * 시·군·구마다 한 자리를 만든다. 예전에는 시·도 단위라 나주와 순천에
 * 다녀와도 '전남' 한 곳에만 색이 들어갔고, 그 자리가 시·도 중심이라 실제로
 * 간 곳과 멀리 떨어졌다(2026-09-21 확인). 지도가 시·군·구 단위가 되면서
 * 행정구역이 곧 자리가 되어 거리로 묶을 일이 없어졌다(2026-09-22).
 *
 * 저장된 좌표를 그대로 쓴다. 장소 검색에서 고른 검증된 값이므로 지어내는
 * 것이 아니다. 좌표가 없는 장소는 지도에 찍지 않고 합계에만 남는다.
 */
export function visitSpots(trips: readonly Trip[], today: IsoDate): VisitSpot[] {
  const spots = new Map<string, { lat: number; lng: number; count: number }>();

  for (const trip of trips) {
    // 방문 판정은 집계와 같다. 종료일이 오늘과 같은 날은 아직 여행 중이다.
    if (trip.endDate === null || trip.endDate >= today) continue;

    const regionById = new Map(trip.regions.map((r) => [r.id, r]));
    const stops = trip.stops.filter((s) => !s.excluded && s.kind !== 'buffer');

    for (const item of [...stops, ...trip.stays]) {
      if (!usable(item.location)) continue;

      const region = item.regionId === null ? null : (regionById.get(item.regionId) ?? null);
      // 주소를 먼저 읽는다. 집계와 같은 기준이어야 지도와 목록이 어긋나지
      // 않는다(util/item-province).
      const code = itemRegionCode(item.address, region);
      if (!code || !REGION_LABEL[code]) continue;

      const near = spots.get(code);
      if (near) {
        // 평균을 갱신한다. 모인 자리가 실제 방문지들의 가운데를 가리킨다.
        near.lat = (near.lat * near.count + item.location.lat) / (near.count + 1);
        near.lng = (near.lng * near.count + item.location.lng) / (near.count + 1);
        near.count += 1;
      } else {
        spots.set(code, { lat: item.location.lat, lng: item.location.lng, count: 1 });
      }
    }
  }

  return [...spots.entries()].map(([regionCode, s]) => ({
    regionCode,
    name: REGION_LABEL[regionCode] ?? regionCode,
    location: { lat: s.lat, lng: s.lng },
    count: s.count,
  }));
}
