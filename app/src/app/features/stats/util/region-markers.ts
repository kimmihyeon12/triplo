import type { GeoCollection } from '../../../shared/util/geo/geo-grid';
import { pointInPolygon } from '../../../shared/util/geo/projection';
import type { RegionMapMarker, SavedMapMarker } from '../model/map-marker';

/** Region anchors are presentation only; saved place coordinates are never changed. */
export function regionMarkers(markers: readonly SavedMapMarker[], geo: GeoCollection,
  codes: Readonly<Record<string, string>>, names: Readonly<Record<string, string>>): RegionMapMarker[] {
  const regions = new Map<string, RegionMapMarker>();
  for (const marker of markers) {
    const point = { x: marker.location.lng, y: marker.location.lat };
    const feature = geo.features.find(feature => {
      const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      return polygons.some(rings => pointInPolygon(point, rings.map(ring => ring.map(([x, y]) => ({ x, y })))));
    });
    const id = feature ? codes[String(feature.properties['code'])] : undefined;
    if (id && names[id]) regions.set(id, { id, name: names[id] });
  }
  return [...regions.values()];
}
