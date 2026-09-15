import type { DayMapModel, MapMarker, MapBounds } from '../../places/model/map';
import { daySegments } from './itinerary';
import { isLocationVerified } from './location';
import type { GeoPoint } from '../../places/model/place';
import type { IsoDate, Trip } from '../model/trip';
import { dayStayInfo } from './stays';

export function buildDayMap(trip: Trip, date: IsoDate): DayMapModel {
  const markers: MapMarker[] = [];
  let unverifiedActiveCount = 0;
  let excludedCount = 0;
  let unverifiedStayCount = 0;
  let number = 0;
  const info = dayStayInfo(trip, date);
  // 숙소도 일정의 한 자리를 차지하므로 순번과 안내선을 장소와 함께 계산한다.
  const numbered: { position: GeoPoint }[] = [];

  for (const seg of daySegments(trip, date)) {
    if (seg.type === 'leg') continue;
    if (seg.type === 'stay') {
      const stay = seg.stay;
      number++;
      if (!isLocationVerified(stay)) {
        unverifiedStayCount++;
        continue;
      }
      const marker: MapMarker = {
        id: stay.id,
        kind: 'stay',
        number,
        position: stay.location!,
        title: stay.name,
        subtitle: `숙소 · ${info.consecutive ? '연박' : '체크인'}`,
      };
      markers.push(marker);
      numbered.push(marker);
      continue;
    }
    const stop = seg.stop;
    if (stop.excluded) {
      excludedCount++;
      continue;
    }
    number++;
    if (!isLocationVerified(stop)) {
      unverifiedActiveCount++;
      continue;
    }
    const marker: MapMarker = {
      id: stop.id,
      kind: 'stop',
      number,
      position: stop.location!,
      title: stop.name,
      subtitle: stop.address,
    };
    markers.push(marker);
    numbered.push(marker);
  }

  // 체크아웃만 하는 숙소는 그날 일정에 서지 않으므로 번호 없이 참고용으로만 찍는다.
  for (const stay of info.checkOuts) {
    if (markers.some((m) => m.id === stay.id)) continue;
    if (!isLocationVerified(stay)) {
      unverifiedStayCount++;
      continue;
    }
    markers.push({
      id: stay.id,
      kind: 'stay',
      number: null,
      position: stay.location!,
      title: stay.name,
      subtitle: '숙소 · 체크아웃',
    });
  }

  const guideLine = numbered.length >= 2 ? numbered.map((m) => m.position) : [];

  let bounds: MapBounds | null = null;
  for (const m of markers) {
    const { lat, lng } = m.position;
    bounds = bounds
      ? {
          south: Math.min(bounds.south, lat),
          north: Math.max(bounds.north, lat),
          west: Math.min(bounds.west, lng),
          east: Math.max(bounds.east, lng),
        }
      : { south: lat, north: lat, west: lng, east: lng };
  }

  return { markers, guideLine, bounds, unverifiedActiveCount, unverifiedStayCount, excludedCount };
}


/** 순번 마커와 사실상 같은 좌표(약 1m 이내)에 놓인 숙소 마커 id. 제공자가 오프셋 표시에 쓴다. */
