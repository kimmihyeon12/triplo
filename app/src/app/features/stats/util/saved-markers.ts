import type { Trip } from '../../trips/model/trip';
import type { VisitFilter } from '../model/visit-stats';
import type { SavedMapMarker } from '../model/map-marker';

export function savedMarkers(trips: readonly Trip[], filter: VisitFilter): SavedMapMarker[] {
  const points = new Map<string, SavedMapMarker>();
  for (const trip of trips) {
    const stops = trip.stops.filter(stop => !stop.excluded && stop.kind !== 'buffer'
      && (filter === 'all' || stop.kind === (filter === 'travel' ? 'place' : filter)));
    const items = [...stops, ...(filter === 'all' || filter === 'travel' ? trip.stays : [])];
    for (const item of items) {
      const p = item.location;
      if (item.locationStatus !== 'verified' || !p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)
        || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) continue;
      const id = `${p.lat},${p.lng}`;
      const marker = points.get(id) ?? { id, name: item.name, location: { ...p }, places: [] };
      marker.places.push({ id: item.id, tripId: trip.id, name: item.name });
      points.set(id, marker);
    }
  }
  return [...points.values()];
}
