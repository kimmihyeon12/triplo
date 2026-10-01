import { InjectionToken } from '@angular/core';
import type { PlaceCandidate } from '../model/place';
import type { GeoPoint } from '../model/place';
import type { MapBounds, NearbyCategory } from '../model/map';

export interface PlaceSearchOptions {
  /** 이 좌표 주변을 우선 검색(제공자가 지원할 때) */
  near?: GeoPoint | null;
  /** near 주변 몇 미터 안에서만 찾을지(제공자가 지원할 때). 없으면 범위를 두지 않는다. */
  radius?: number;
  size?: number;
}

export interface PlaceSearchResult {
  candidates: PlaceCandidate[];
  /** 제공자가 알려준 전체 건수(모르면 candidates.length) */
  total: number;
}

export interface PlaceSearchAvailability {
  available: boolean;
  /** 사용 불가 사유(키 없음 등). 화면에 그대로 표시한다 */
  reason: string | null;
  providerLabel: string;
}

/**
 * 장소 검색 제공자 어댑터. 화면은 이 인터페이스만 사용한다.
 * 결과의 좌표는 제공자가 돌려준 값 그대로이며 앱이 추정하지 않는다.
 */
export interface PlaceSearchProvider {
  availability(): Promise<PlaceSearchAvailability>;
  search(query: string, options?: PlaceSearchOptions): Promise<PlaceSearchResult>;
}

export const PLACE_SEARCH = new InjectionToken<PlaceSearchProvider>('PLACE_SEARCH');

export type { NearbyPlace } from '../model/map';
import type { NearbyPlace } from '../model/map';

/**
 * 지도 범위 안의 분류별 장소(2026-10-01, 큰 지도). 이름 검색과 따로 둔다.
 * 사용자가 분류를 누르거나 '이 지역에서 다시 찾기'를 누를 때만 부른다(무료 한도).
 */
export interface NearbyPlaceSearch {
  nearby(category: NearbyCategory, bounds: MapBounds): Promise<NearbyPlace[]>;
}

export const NEARBY_PLACE_SEARCH = new InjectionToken<NearbyPlaceSearch>('NEARBY_PLACE_SEARCH');
