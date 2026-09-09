import type { AccommodationStay, GeoPoint, PlaceRef, TripStop } from './model';

/** 장소 검색 제공자가 돌려주는 후보. 제공자별 어댑터가 이 형태로 정규화한다. */
export interface PlaceCandidate {
  provider: PlaceRef['provider'];
  id: string;
  name: string;
  /** 지번 주소 */
  address: string;
  /** 도로명 주소(없으면 빈 문자열) */
  roadAddress: string;
  lat: number;
  lng: number;
  category: string;
  url: string | null;
}

type Locatable = TripStop | AccommodationStay;

/** 사용자가 검색 결과를 선택했을 때만 좌표를 확정한다. */
export function applyPlaceCandidate<T extends Locatable>(entity: T, candidate: PlaceCandidate): T {
  const location: GeoPoint = { lat: candidate.lat, lng: candidate.lng };
  const placeRef: PlaceRef = { provider: candidate.provider, id: candidate.id, url: candidate.url };
  return {
    ...entity,
    name: candidate.name,
    address: candidate.roadAddress || candidate.address,
    location,
    placeRef,
    locationStatus: 'verified',
  };
}

/** 좌표·참조만 제거한다. 이름·주소는 사용자 입력으로 남긴다. */
export function clearLocation<T extends Locatable>(entity: T): T {
  return { ...entity, location: null, placeRef: null, locationStatus: 'unverified' };
}

export function isLocationVerified(entity: Pick<Locatable, 'location'> | { location?: GeoPoint | null }): boolean {
  const loc = entity.location;
  return !!loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng);
}
