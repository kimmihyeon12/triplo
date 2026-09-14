import type { Trip } from '../model/trip';

export function estimatedCosts(trip: Trip): { total: number; unknown: number } {
  const items = [...trip.stops.filter((s) => !s.excluded), ...trip.stays];
  return {
    total: items.reduce((n, s) => n + (s.estimatedCost ?? 0), 0),
    unknown: items.filter((s) => s.estimatedCost == null).length,
  };
}
