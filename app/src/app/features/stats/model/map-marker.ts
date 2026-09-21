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
}
