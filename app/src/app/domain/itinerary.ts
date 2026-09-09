import type { IsoDate, Trip, TripStop } from './model';

function byOrder(a: TripStop, b: TripStop): number {
  return a.order - b.order;
}

export function dayStops(trip: Trip, date: IsoDate): TripStop[] {
  return trip.stops.filter((s) => s.date === date).sort(byOrder);
}

export function unassignedStops(trip: Trip): TripStop[] {
  return trip.stops.filter((s) => s.date === null).sort(byOrder);
}

function renumber(stops: TripStop[], date: IsoDate | null): TripStop[] {
  const group = stops.filter((s) => s.date === date).sort(byOrder);
  const orderById = new Map(group.map((s, i) => [s.id, i] as const));
  return stops.map((s) => (s.date === date ? { ...s, order: orderById.get(s.id)! } : s));
}

/** 같은 날짜 안에서 위·아래로 한 칸 이동. 끝이거나 미배치면 그대로. */
export function moveStop(trip: Trip, stopId: string, direction: 'up' | 'down'): Trip {
  const target = trip.stops.find((s) => s.id === stopId);
  if (!target || target.date === null) return trip;
  const group = dayStops(trip, target.date);
  const idx = group.findIndex((s) => s.id === stopId);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= group.length) return trip;
  const other = group[swapIdx];
  const stops = trip.stops.map((s) =>
    s.id === target.id ? { ...s, order: other.order } : s.id === other.id ? { ...s, order: target.order } : s,
  );
  return { ...trip, stops: renumber(stops, target.date) };
}

/** 항목을 다른 날짜(또는 미배치)의 마지막 순서로 옮긴다. */
export function placeStopOnDate(trip: Trip, stopId: string, date: IsoDate | null): Trip {
  const target = trip.stops.find((s) => s.id === stopId);
  if (!target) return trip;
  const from = target.date;
  const last = trip.stops.filter((s) => s.date === date && s.id !== stopId).length;
  let stops = trip.stops.map((s) => (s.id === stopId ? { ...s, date, order: last } : s));
  stops = renumber(stops, from);
  stops = renumber(stops, date);
  return { ...trip, stops };
}

/** 새 항목을 해당 날짜 마지막 순서로 추가 */
export function appendStop(trip: Trip, stop: TripStop): Trip {
  const last = trip.stops.filter((s) => s.date === stop.date).length;
  return { ...trip, stops: [...trip.stops, { ...stop, order: last }] };
}

export function updateStop(trip: Trip, updated: TripStop): Trip {
  const prev = trip.stops.find((s) => s.id === updated.id);
  if (!prev) return trip;
  const merged = { ...trip, stops: trip.stops.map((s) => (s.id === updated.id ? { ...updated, order: prev.order } : s)) };
  return prev.date === updated.date ? merged : placeStopOnDate(merged, updated.id, updated.date);
}

export function removeStop(trip: Trip, stopId: string): Trip {
  const target = trip.stops.find((s) => s.id === stopId);
  if (!target) return trip;
  const stops = trip.stops.filter((s) => s.id !== stopId);
  return { ...trip, stops: renumber(stops, target.date) };
}

export function toggleExcluded(trip: Trip, stopId: string): Trip {
  return { ...trip, stops: trip.stops.map((s) => (s.id === stopId ? { ...s, excluded: !s.excluded } : s)) };
}

export interface DayTotals {
  /** 제외되지 않은 항목의 체류 합계(분) */
  stayMinutes: number;
  activeCount: number;
  /** 체류시간 미정 항목 수 */
  unknownStayCount: number;
  /** 이동 구간 수 = 활성 항목 수 − 1 */
  legCount: number;
  /** 경로 조회가 없으므로 모든 구간이 미확인 */
  unknownLegCount: number;
}

export function dayTotals(trip: Trip, date: IsoDate): DayTotals {
  const active = dayStops(trip, date).filter((s) => !s.excluded);
  const stayMinutes = active.reduce((sum, s) => sum + (s.stayMinutes ?? 0), 0);
  const unknownStayCount = active.filter((s) => s.stayMinutes === null).length;
  const legCount = Math.max(0, active.length - 1);
  return { stayMinutes, activeCount: active.length, unknownStayCount, legCount, unknownLegCount: legCount };
}

export type DaySegment =
  | { type: 'stop'; stop: TripStop }
  | { type: 'leg'; fromRegion: string | null; toRegion: string | null; regionChange: boolean };

/** 시간순 항목과 그 사이 이동 구간. 제외 항목 앞뒤에는 구간을 두지 않는다. */
export function daySegments(trip: Trip, date: IsoDate): DaySegment[] {
  const regionName = (id: string | null) => trip.regions.find((r) => r.id === id)?.name ?? null;
  const out: DaySegment[] = [];
  let prevActive: TripStop | null = null;
  // 지역이 없는 식사·휴식 항목이 사이에 있어도 지역 이동을 놓치지 않도록 마지막으로 알려진 지역을 기억한다.
  let lastKnownRegion: string | null = null;
  for (const stop of dayStops(trip, date)) {
    if (!stop.excluded && prevActive) {
      const toRegion = regionName(stop.regionId);
      const regionChange = !!lastKnownRegion && !!toRegion && lastKnownRegion !== toRegion;
      out.push({ type: 'leg', fromRegion: lastKnownRegion, toRegion, regionChange });
    }
    out.push({ type: 'stop', stop });
    if (!stop.excluded) {
      prevActive = stop;
      lastKnownRegion = regionName(stop.regionId) ?? lastKnownRegion;
    }
  }
  return out;
}

/** 그날 사용한 지역 이름을 등장 순서대로 */
export function dayRegionNames(trip: Trip, date: IsoDate): string[] {
  const names: string[] = [];
  for (const s of dayStops(trip, date)) {
    if (s.excluded) continue;
    const name = trip.regions.find((r) => r.id === s.regionId)?.name;
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

export interface FixedTimeConflict {
  earlierId: string;
  laterId: string;
}

/** 순서상 앞 항목의 고정 시각이 뒤 항목의 고정 시각보다 늦으면 충돌 */
export function fixedTimeConflicts(trip: Trip, date: IsoDate): FixedTimeConflict[] {
  const fixed = dayStops(trip, date).filter((s) => !s.excluded && s.fixedTime);
  const out: FixedTimeConflict[] = [];
  for (let i = 0; i < fixed.length - 1; i++) {
    if (fixed[i].fixedTime! > fixed[i + 1].fixedTime!) out.push({ earlierId: fixed[i].id, laterId: fixed[i + 1].id });
  }
  return out;
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}
