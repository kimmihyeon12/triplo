import type { GeoPoint } from './place';

export interface MapMarker {
  id: string;
  kind: 'stop' | 'stay';
  /** 일정 순번(활성 항목 기준). 숙소는 null */
  number: number | null;
  position: GeoPoint;
  title: string;
  subtitle: string;
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

