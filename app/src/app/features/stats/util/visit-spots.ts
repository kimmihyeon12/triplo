import { PROVINCE_SHORT_NAME, findRegionByName, provinceCodeOf } from '../../../shared/util/korea-regions';
import type { GeoPoint } from '../../places/model/place';
import type { IsoDate, Trip } from '../../trips/model/trip';
import { provinceCodeForAddress } from './province-match';
import { isMetro, spotName } from './spot-name';

/** 지도에 찍을 방문 자리 하나. 여러 장소가 가까우면 한 자리로 모인다. */
export interface VisitSpot {
  /** 이 자리가 속한 시·도. 색 단계와 지역 목록은 이 값을 쓴다. */
  regionCode: string;
  /**
   * 마커에 적을 이름. 주소에서 읽은 시·군이며 광역시는 시·도 이름이다.
   * 시·도만 적으면 나주와 순천이 둘 다 '전남'으로 보여 구분되지 않는다.
   */
  name: string;
  /** 모인 장소들의 평균 좌표. 저장된 값에서만 낸다. */
  location: GeoPoint;
  /** 이 자리에 모인 장소 수. 높이와 색의 진하기를 정한다. */
  count: number;
}

/**
 * 이름을 읽지 못한 자리를 묶을 거리(km).
 *
 * 같은 행정구역이면 거리와 무관하게 묶으므로 이 값은 주소가 없어 이름을
 * 못 낸 자리에만 쓴다. 지도 격자 한 칸과 같아 이보다 가까우면 어차피 같은
 * 칸에 들어간다.
 */
const MERGE_KM = 11;

/** 위도 1도의 거리. 경도는 위도에 따라 짧아지므로 그때그때 곱한다. */
const KM_PER_DEGREE = 111;

function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const lat = (a.lat + b.lat) / 2;
  const dx = (a.lng - b.lng) * Math.cos((lat * Math.PI) / 180) * KM_PER_DEGREE;
  const dy = (a.lat - b.lat) * KM_PER_DEGREE;
  return Math.hypot(dx, dy);
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
 * 지금까지는 시·도마다 한 덩어리로 찍어, 나주와 순천에 다녀와도 전남 한
 * 곳에만 색이 들어갔다. 게다가 그 자리가 시·도 중심이라 실제로 간 곳과
 * 멀리 떨어졌다(2026-09-21 확인).
 *
 * 저장된 좌표를 그대로 쓴다. 장소 검색에서 고른 검증된 값이므로 지어내는
 * 것이 아니다. 좌표가 없는 장소는 지도에 찍지 않고 합계에만 남는다.
 */
export function visitSpots(trips: readonly Trip[], today: IsoDate): VisitSpot[] {
  const spots: { regionCode: string; name: string; named: boolean; lat: number; lng: number; count: number }[] = [];

  for (const trip of trips) {
    // 방문 판정은 집계와 같다. 종료일이 오늘과 같은 날은 아직 여행 중이다.
    if (trip.endDate === null || trip.endDate >= today) continue;

    const regionById = new Map(trip.regions.map((r) => [r.id, r]));
    const stops = trip.stops.filter((s) => !s.excluded && s.kind !== 'buffer');

    for (const item of [...stops, ...trip.stays]) {
      if (!usable(item.location)) continue;

      const region = item.regionId === null ? null : regionById.get(item.regionId);
      const resolved = region
        ? region.regionCode ?? findRegionByName(region.name)?.code ?? null
        : null;
      // 여행 지역으로 못 찾으면 주소를 읽는다. 집계와 같은 순서다.
      const code = resolved ? provinceCodeOf(resolved) : provinceCodeForAddress(item.address);
      if (!code || !PROVINCE_SHORT_NAME[code]) continue;

      /*
        같은 행정구역이면 한 자리로 묶는다. 거리로만 묶으면 광주처럼 넓은
        도시에서 동구와 광산구가 12km 떨어져 '광주' 자리가 둘로 갈리고,
        각각 1곳이라 누적되지 않는다(2026-09-22 확인).

        이름을 못 읽은 자리는 시·도 이름이 되어 서로 구분되지 않으므로
        거리로 묶는다.
      */
      const name = spotName(item.address, code);
      // 광역시는 시·도가 곧 행정구역이라 이름이 같아도 '읽은' 것으로 본다.
      const named = isMetro(code) || name !== (PROVINCE_SHORT_NAME[code] ?? code);
      const near = spots.find((s) =>
        s.regionCode === code &&
        (named ? s.name === name : !s.named && distanceKm(s, item.location!) <= MERGE_KM),
      );
      if (near) {
        // 평균을 갱신한다. 모인 자리가 실제 방문지들의 가운데를 가리킨다.
        near.lat = (near.lat * near.count + item.location.lat) / (near.count + 1);
        near.lng = (near.lng * near.count + item.location.lng) / (near.count + 1);
        near.count += 1;
      } else {
        spots.push({ regionCode: code, name, named,
          lat: item.location.lat, lng: item.location.lng, count: 1 });
      }
    }
  }

  return spots.map((s) => ({
    regionCode: s.regionCode,
    name: s.name,
    location: { lat: s.lat, lng: s.lng },
    count: s.count,
  }));
}
