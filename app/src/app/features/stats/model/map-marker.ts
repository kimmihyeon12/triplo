import type { GeoPoint } from '../../places/model/place';

export interface SavedMapMarker {
  id: string;
  name: string;
  location: GeoPoint;
  places: { id: string; tripId: string; name: string }[];
}

export interface RegionMapMarker {
  id: string;
  name: string;
}

/** Screen-only selection: never a saved geographic/place record. */
export interface MapLabel {
  id: string;
  name: string;
  x: number;
  y: number;
  temporary: boolean;
  /** 이 자리의 방문 수. 마커가 겹칠 때 많이 간 곳을 먼저 남긴다. */
  count?: number;
  /** 이름표가 이웃과 겹쳐 가린 상태. 점은 그대로 보인다. */
  labelHidden?: boolean;
}
