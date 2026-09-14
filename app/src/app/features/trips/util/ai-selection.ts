import type { AiPlanSelection } from '../../ai-planning/model/ai-plan';
import { addDays, diffDays } from '../../../shared/util/dates';
import { createRegion, createStop, createTrip } from './factories';
import { appendStop } from './itinerary';
import type { Trip } from '../model/trip';

/** Applies the AI flow's selection contract; all sample coordinates remain unknown. */
export function selectionToTrip(selection: AiPlanSelection): Trip {
  let trip = createTrip({
    id: selection.requestId,
    title: selection.regions.length ? `${selection.regions.join('·')} 여행` : '새 여행',
    startDate: selection.startDate, endDate: selection.endDate,
    regions: selection.regions.map((name, i) => createRegion(name, i, `${selection.requestId}:region:${i}`)),
  });
  const lastDay = trip.startDate && trip.endDate ? diffDays(trip.startDate, trip.endDate) + 1 : 0;
  for (const item of selection.items) {
    if (!item.verified) continue;
    const date = trip.startDate && item.day >= 1 && item.day <= lastDay ? addDays(trip.startDate, item.day - 1) : null;
    trip = appendStop(trip, createStop({ id: `${selection.requestId}:${item.id}`, name: item.name,
      kind: item.kindLabel === '식사' ? 'meal' : 'place', memo: `샘플 결과 · ${item.note}`, date, location: null }));
  }
  return trip;
}
