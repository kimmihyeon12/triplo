import type { GeoPoint, PlaceCandidate } from './place';

export interface MapMarker {
  id: string;
  kind: 'stop' | 'stay';
  /** 일정 순번(활성 항목 기준). 숙소는 null */
  number: number | null;
  position: GeoPoint;
  title: string;
  subtitle: string;
}

/** 큰 지도에서 고르는 주변 장소의 분류(2026-10-01). 카카오 분류 FD6·CE7·AT4·AD5에 맞춘다. */
export type NearbyCategory = 'meal' | 'cafe' | 'sight' | 'stay';

/** 주변 장소 찾기 결과. 어느 분류 버튼으로 찾았는지 함께 남긴다. */
export interface NearbyPlace extends PlaceCandidate {
  nearby: NearbyCategory;
}

/** 큰 지도의 주변 장소 핀. 일정 마커와 다른 층에 그린다. */
export interface PlacePin {
  id: string;
  category: NearbyCategory;
  position: GeoPoint;
  title: string;
  /** 이미 이 여행에 담은 곳이면 true(표시만 다르다) */
  added: boolean;
  /** 읽어 둔 방문자 평점. 아직 모르거나 후기가 없으면 null */
  rating: number | null;
}

export interface MapBounds {
  south: number;
  north: number;
  west: number;
  east: number;
}

export interface DayMapModel {
  markers: MapMarker[];
  /** 방문 순서 안내선(경로 아님). 순번 마커 좌표를 순서대로 */
  guideLine: GeoPoint[];
  bounds: MapBounds | null;
  /** 좌표가 없어 지도에 못 그린 활성 일정 항목 수 */
  unverifiedActiveCount: number;
  /** 좌표가 없어 지도에 못 그린 그날 숙소 수 */
  unverifiedStayCount: number;
  excludedCount: number;
}
