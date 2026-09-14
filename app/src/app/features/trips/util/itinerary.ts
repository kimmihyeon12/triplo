import type { GeoPoint } from '../../places/model/place';
import type { IsoDate, Trip, TripStop } from '../model/trip';

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
    s.id === target.id
      ? { ...s, order: other.order }
      : s.id === other.id
        ? { ...s, order: target.order }
        : s,
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
  const merged = {
    ...trip,
    stops: trip.stops.map((s) => (s.id === updated.id ? { ...updated, order: prev.order } : s)),
  };
  return prev.date === updated.date ? merged : placeStopOnDate(merged, updated.id, updated.date);
}

export function removeStop(trip: Trip, stopId: string): Trip {
  const target = trip.stops.find((s) => s.id === stopId);
  if (!target) return trip;
  const stops = trip.stops.filter((s) => s.id !== stopId);
  return { ...trip, stops: renumber(stops, target.date) };
}

export function toggleExcluded(trip: Trip, stopId: string): Trip {
  return {
    ...trip,
    stops: trip.stops.map((s) => (s.id === stopId ? { ...s, excluded: !s.excluded } : s)),
  };
}

/** 지구 반경(km). 두 좌표 사이 대권 거리를 구할 때 쓴다. */
const EARTH_RADIUS_KM = 6371;

/**
 * 두 좌표 사이의 직선 거리(km).
 * 실제 이동 거리가 아니라 지도상 직선 거리이므로 도로·대중교통 사정을 반영하지 않는다.
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface NearestSortResult {
  readonly trip: Trip;
  /** 좌표가 있어 정렬 대상이 된 항목 수 */
  readonly sortedCount: number;
  /** 좌표가 없어 제자리에 남은 항목 수 */
  readonly unlocatedCount: number;
  /** 고정 시각이 있어 제자리에 남은 항목 수 */
  readonly fixedCount: number;
}

/**
 * 하루 일정을 첫 항목에서 출발해 가까운 곳부터 잇는 순서로 다시 배열한다.
 *
 * 직선 거리 기준이며 실제 이동 시간이 아니다. 도로 사정·대중교통·영업시간을
 * 반영하지 않으므로 제안일 뿐이고, 사용자가 확인해 조정해야 한다.
 *
 * 다음 항목은 자리를 바꾸지 않고 원래 위치에 남긴다.
 * - 고정 시각이 있는 항목: 예약 시간을 지켜야 하므로 순서를 옮기면 안 된다.
 * - 좌표가 없는 항목: 거리를 계산할 수 없다.
 * 나머지 항목만 서로 자리를 바꾸며, 첫 번째 이동 가능 항목을 출발점으로 삼는다.
 */
export function sortDayByNearest(trip: Trip, date: IsoDate): NearestSortResult {
  const group = dayStops(trip, date);
  const movable = group.filter((s) => s.fixedTime === null && s.location !== null);
  const fixedCount = group.filter((s) => s.fixedTime !== null).length;
  const unlocatedCount = group.filter((s) => s.fixedTime === null && s.location === null).length;

  // 두 곳 미만이면 바꿀 것이 없다.
  if (movable.length < 2) {
    return { trip, sortedCount: movable.length, unlocatedCount, fixedCount };
  }

  // 첫 이동 가능 항목을 출발점으로 두고 가장 가까운 곳을 차례로 잇는다.
  const remaining = movable.slice(1);
  const ordered: TripStop[] = [movable[0]];
  while (remaining.length > 0) {
    const from = ordered[ordered.length - 1].location!;
    let bestIdx = 0;
    let bestKm = haversineKm(from, remaining[0].location!);
    for (let i = 1; i < remaining.length; i++) {
      const km = haversineKm(from, remaining[i].location!);
      if (km < bestKm) {
        bestKm = km;
        bestIdx = i;
      }
    }
    ordered.push(remaining.splice(bestIdx, 1)[0]);
  }

  // 이동 가능 항목이 있던 자리에만 새 순서를 채워 넣는다.
  const movableIds = new Set(movable.map((s) => s.id));
  let cursor = 0;
  const nextGroup = group.map((s) => (movableIds.has(s.id) ? ordered[cursor++] : s));
  const orderById = new Map(nextGroup.map((s, i) => [s.id, i] as const));
  const stops = trip.stops.map((s) =>
    orderById.has(s.id) ? { ...s, order: orderById.get(s.id)! } : s,
  );

  return { trip: { ...trip, stops }, sortedCount: movable.length, unlocatedCount, fixedCount };
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
  return {
    stayMinutes,
    activeCount: active.length,
    unknownStayCount,
    legCount,
    unknownLegCount: legCount,
  };
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
    if (fixed[i].fixedTime! > fixed[i + 1].fixedTime!)
      out.push({ earlierId: fixed[i].id, laterId: fixed[i + 1].id });
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
