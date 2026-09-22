import type { GeoCollection } from '../../../shared/util/geo/geo-grid';
import { pointInPolygon } from '../../../shared/util/geo/projection';
import type { RegionMapMarker, SavedMapMarker } from '../model/map-marker';

/**
 * 저장한 장소가 어느 지역에 드는지 본다.
 *
 * 지역 자리는 화면에 찍기 위한 값이며 저장된 장소 좌표를 바꾸지 않는다.
 * 경계 파일이 지역 코드를 직접 주므로 변환 표가 따로 필요 없다.
 */
export function regionMarkers(
  markers: readonly SavedMapMarker[],
  geo: GeoCollection,
  names: Readonly<Record<string, string>>,
): RegionMapMarker[] {
  const regions = new Map<string, RegionMapMarker>();
  for (const marker of markers) {
    const point = { x: marker.location.lng, y: marker.location.lat };
    const feature = geo.features.find(feature => {
      const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      return polygons.some(rings => pointInPolygon(point, rings.map(ring => ring.map(([x, y]) => ({ x, y })))));
    });
    const id = feature ? String(feature.properties['cd']) : undefined;
    if (id && names[id]) regions.set(id, { id, name: names[id] });
  }
  return [...regions.values()];
}
