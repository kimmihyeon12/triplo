import { dayStops } from './itinerary';
import { isLocationVerified } from './location';
import type { GeoPoint, IsoDate, Trip } from './model';
import { dayStayInfo } from './stays';

export interface MapMarker {
  id: string;
  kind: 'stop' | 'stay';
  /** 일정 순번(활성 항목 기준). 숙소는 null */
  number: number | null;
  position: GeoPoint;
  title: string;
  subtitle: string;
}

export interface MapBounds {
  south: number;
  north: number;
  west: number;
  east: number;
}

export interface DayMapModel {
  markers: MapMarker[];
  /** 방문 순서 안내선(경로 아님). 순번 마커 좌표를 순서대로 */
  guideLine: GeoPoint[];
  bounds: MapBounds | null;
  /** 좌표가 없어 지도에 못 그린 활성 일정 항목 수 */
  unverifiedActiveCount: number;
  /** 좌표가 없어 지도에 못 그린 그날 숙소 수 */
  unverifiedStayCount: number;
  excludedCount: number;
}

export function buildDayMap(trip: Trip, date: IsoDate): DayMapModel {
  const markers: MapMarker[] = [];
  let unverifiedActiveCount = 0;
  let excludedCount = 0;
  let number = 0;
  for (const stop of dayStops(trip, date)) {
    if (stop.excluded) {
      excludedCount++;
      continue;
    }
    number++;
    if (!isLocationVerified(stop)) {
      unverifiedActiveCount++;
      continue;
    }
    markers.push({ id: stop.id, kind: 'stop', number, position: stop.location!, title: stop.name, subtitle: stop.address });
  }

  const info = dayStayInfo(trip, date);
  const stays = [...info.checkOuts, ...info.tonight.filter((s) => !info.checkOuts.some((c) => c.id === s.id))];
  let unverifiedStayCount = 0;
  for (const stay of stays) {
    if (!isLocationVerified(stay)) {
      unverifiedStayCount++;
      continue;
    }
    const role = info.checkOuts.some((c) => c.id === stay.id) ? '체크아웃' : info.consecutive ? '연박' : '체크인';
    markers.push({ id: stay.id, kind: 'stay', number: null, position: stay.location!, title: stay.name, subtitle: `숙소 · ${role}` });
  }

  const numbered = markers.filter((m) => m.kind === 'stop').map((m) => m.position);
  const guideLine = numbered.length >= 2 ? numbered : [];

  let bounds: MapBounds | null = null;
  for (const m of markers) {
    const { lat, lng } = m.position;
    bounds = bounds
      ? { south: Math.min(bounds.south, lat), north: Math.max(bounds.north, lat), west: Math.min(bounds.west, lng), east: Math.max(bounds.east, lng) }
      : { south: lat, north: lat, west: lng, east: lng };
  }

  return { markers, guideLine, bounds, unverifiedActiveCount, unverifiedStayCount, excludedCount };
}

/** 숙소 탭용: 확인된 좌표의 모든 숙박을 숙소 마커로 표시한다(안내선 없음). */
export function buildStaysMap(trip: Trip): DayMapModel {
  const markers: MapMarker[] = [];
  let unverifiedStayCount = 0;
  for (const stay of [...trip.stays].sort((a, b) => (a.checkIn < b.checkIn ? -1 : 1))) {
    if (!isLocationVerified(stay)) {
      unverifiedStayCount++;
      continue;
    }
    markers.push({ id: stay.id, kind: 'stay', number: null, position: stay.location!, title: stay.name, subtitle: `숙소 · ${stay.checkIn} ~ ${stay.checkOut}` });
  }
  let bounds: MapBounds | null = null;
  for (const m of markers) {
    const { lat, lng } = m.position;
    bounds = bounds
      ? { south: Math.min(bounds.south, lat), north: Math.max(bounds.north, lat), west: Math.min(bounds.west, lng), east: Math.max(bounds.east, lng) }
      : { south: lat, north: lat, west: lng, east: lng };
  }
  return { markers, guideLine: [], bounds, unverifiedActiveCount: 0, unverifiedStayCount, excludedCount: 0 };
}

/** 순번 마커와 사실상 같은 좌표(약 1m 이내)에 놓인 숙소 마커 id. 제공자가 오프셋 표시에 쓴다. */
export function overlappingStayIds(markers: MapMarker[]): Set<string> {
  const out = new Set<string>();
  const stops = markers.filter((m) => m.kind === 'stop');
  for (const stay of markers.filter((m) => m.kind === 'stay')) {
    if (stops.some((s) => Math.abs(s.position.lat - stay.position.lat) < 0.00001 && Math.abs(s.position.lng - stay.position.lng) < 0.00001)) out.add(stay.id);
  }
  return out;
}
