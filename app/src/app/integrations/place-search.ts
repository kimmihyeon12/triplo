import { InjectionToken } from '@angular/core';
import type { PlaceCandidate } from '../domain/location';
import type { GeoPoint } from '../domain/model';

export interface PlaceSearchOptions {
  /** 이 좌표 주변을 우선 검색(제공자가 지원할 때) */
  near?: GeoPoint | null;
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
