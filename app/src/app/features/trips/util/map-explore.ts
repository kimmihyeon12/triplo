import type { NearbyCategory, NearbyPlace, PlacePin } from '../../places/model/map';
import type { IsoDate, StopKind, Trip } from '../model/trip';
import { applyPlaceCandidate } from './location';
import { createStop } from './factories';
import { appendStop } from './itinerary';
import { regionIdForAddress } from './region-match';

/**
 * 큰 지도에서 주변 장소를 골라 일정에 담기(2026-10-01).
 * 설계: docs/superpowers/specs/2026-10-01-map-explore-design.md
 */

/** 분류 버튼 → 일정 종류. 카페는 '카페'(break)다. 숙소는 숙소 화면에서 날짜를 정해 담는다. */
export const NEARBY_KIND: Readonly<Record<Exclude<NearbyCategory, 'stay'>, StopKind>> = {
  meal: 'meal',
  cafe: 'break',
  sight: 'place',
};

/** 같은 장소로 보는 거리(m). 같은 출처 번호가 없을 때만 쓴다. */
const SAME_METERS = 40;

function meters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** 이 여행에 이미 담은 곳인지. 같은 출처 번호거나, 같은 이름이 아주 가까우면 같은 곳이다. */
export function isInTrip(trip: Trip, place: NearbyPlace): boolean {
  return addedState(trip, place) !== false;
}

/** 담은 상태. 일정 맨 아래 후보(제외)면 candidate, 일정에 들었거나 숙소면 scheduled. */
export function addedState(trip: Trip, place: NearbyPlace): false | 'candidate' | 'scheduled' {
  const same = (item: { name: string; location?: { lat: number; lng: number } | null; placeRef?: { provider: string; id: string } | null }) =>
    (item.placeRef?.provider === place.provider && item.placeRef.id === place.id) ||
    (!!item.location && item.name.trim() === place.name.trim() && meters(item.location, place) <= SAME_METERS);
  if (trip.stays.some(same)) return 'scheduled';
  const stops = trip.stops.filter(same);
  if (!stops.length) return false;
  return stops.every((s) => s.excluded) ? 'candidate' : 'scheduled';
}

export function toPins(
  trip: Trip,
  places: readonly NearbyPlace[],
  ratingOf: (id: string) => number | null = () => null,
): PlacePin[] {
  return places.map((p) => ({
    id: p.id,
    category: p.nearby,
    position: { lat: p.lat, lng: p.lng },
    title: p.name,
    added: addedState(trip, p),
    rating: ratingOf(p.id),
  }));
}

/**
 * 고른 장소를 그날 일정 맨 아래에 후보(일정에서 제외)로 더한 여행(2026-10-01 사용자 결정).
 * 지도에서 여러 곳을 골라 두고 비교한 뒤 '일정에 되돌리기'로 넣는다. 후보는 방문 순서·지도 순번·예상 비용에 들지 않는다.
 * 좌표·주소·출처는 검색 제공자의 값 그대로다.
 */
export function addNearbyStop(trip: Trip, place: NearbyPlace, date: IsoDate | null): Trip {
  const kind = place.nearby === 'stay' ? 'place' : NEARBY_KIND[place.nearby];
  const base = createStop({ kind, name: place.name, date });
  const stop = applyPlaceCandidate(base, place);
  return appendStop(trip, { ...stop, excluded: true, regionId: regionIdForAddress(stop.address, trip.regions) });
}
