import { enumerateDays, tripNights } from './dates';
import type { AccommodationStay, IsoDate, Trip, TripStop } from './model';
import { stayNights } from './stays';

export interface PeriodChangeImpact {
  /** 새 기간 밖 날짜에 있어 미배치로 옮겨질 장소 */
  displacedStops: TripStop[];
  /** 새 기간 밖 밤을 포함하는 숙박(보존하되 표시) */
  outOfRangeStays: AccommodationStay[];
  hasImpact: boolean;
}

export function periodChangeImpact(trip: Trip, start: IsoDate | null, end: IsoDate | null): PeriodChangeImpact {
  const undecided = !start || !end;
  const days = undecided ? new Set<string>() : new Set(enumerateDays(start!, end!));
  const nights = undecided ? null : new Set(tripNights(start!, end!));
  const displacedStops = trip.stops.filter((s) => s.date !== null && !days.has(s.date));
  const outOfRangeStays = nights ? trip.stays.filter((s) => stayNights(s).some((n) => !nights.has(n))) : [];
  // 기간 밖 숙박은 기존에도 기간 밖이었을 수 있으므로 '새로 기간 밖이 된' 숙박만 영향으로 본다.
  const prevNights = trip.startDate && trip.endDate ? new Set(tripNights(trip.startDate, trip.endDate)) : null;
  const newlyOut = outOfRangeStays.filter((s) => !prevNights || stayNights(s).every((n) => prevNights.has(n)));
  return { displacedStops, outOfRangeStays: newlyOut, hasImpact: displacedStops.length > 0 || newlyOut.length > 0 };
}

/** 기간을 바꾸고 밀려난 장소는 미배치로 보존한다. 숙박은 그대로 둔다. */
export function applyPeriodChange(trip: Trip, start: IsoDate | null, end: IsoDate | null): Trip {
  const { displacedStops } = periodChangeImpact(trip, start, end);
  const displaced = new Set(displacedStops.map((s) => s.id));
  const unassignedCount = trip.stops.filter((s) => s.date === null).length;
  let next = unassignedCount;
  const stops = trip.stops.map((s) => (displaced.has(s.id) ? { ...s, date: null, order: next++ } : s));
  return { ...trip, startDate: start, endDate: end, stops };
}

export interface RegionRemovalImpact {
  stopCount: number;
  stayCount: number;
}

export function regionRemovalImpact(trip: Trip, regionId: string): RegionRemovalImpact {
  return {
    stopCount: trip.stops.filter((s) => s.regionId === regionId).length,
    stayCount: trip.stays.filter((s) => s.regionId === regionId).length,
  };
}

/** 지역을 제거하고 참조만 해제한다. 장소·숙박은 보존한다. */
export function removeRegion(trip: Trip, regionId: string): Trip {
  const regions = trip.regions.filter((r) => r.id !== regionId).map((r, i) => ({ ...r, order: i }));
  return {
    ...trip,
    regions,
    stops: trip.stops.map((s) => (s.regionId === regionId ? { ...s, regionId: null } : s)),
    stays: trip.stays.map((s) => (s.regionId === regionId ? { ...s, regionId: null } : s)),
  };
}
