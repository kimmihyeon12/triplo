import type { DayMapModel, MapMarker } from '../model/map';

export function overlappingStayIds(markers: MapMarker[]): Set<string> {
  const out = new Set<string>();
  const stops = markers.filter((m) => m.kind === 'stop');
  for (const stay of markers.filter((m) => m.kind === 'stay')) {
    if (stops.some((s) => Math.abs(s.position.lat - stay.position.lat) < 0.00001 && Math.abs(s.position.lng - stay.position.lng) < 0.00001)) out.add(stay.id);
  }
  return out;
}
