import { describe, expect, it } from 'vitest';
import { buildDayMap } from './map-markers';
import { createStay, createStop, createTrip } from './model';

const gangneungA = { lat: 37.7519, lng: 128.8761 };
const anmok = { lat: 37.773, lng: 128.9475 };
const ojukheon = { lat: 37.7793, lng: 128.878 };

function trip() {
  return createTrip({
    startDate: '2026-05-01',
    endDate: '2026-05-03',
    stops: [
      createStop({ id: 's1', name: '안목해변', date: '2026-05-01', order: 0, location: anmok, locationStatus: 'verified', stayMinutes: 60 }),
      createStop({ id: 's2', name: '점심', kind: 'meal', date: '2026-05-01', order: 1 }),
      createStop({ id: 's3', name: '오죽헌', date: '2026-05-01', order: 2, location: ojukheon, locationStatus: 'verified' }),
      createStop({ id: 's4', name: '제외됨', date: '2026-05-01', order: 3, location: ojukheon, locationStatus: 'verified', excluded: true }),
    ],
    stays: [
      createStay({ id: 'A', name: 'A 호텔', checkIn: '2026-05-01', checkOut: '2026-05-02', location: gangneungA, locationStatus: 'verified' }),
      createStay({ id: 'B', name: 'B 게스트하우스', checkIn: '2026-05-02', checkOut: '2026-05-03' }),
    ],
  });
}

describe('buildDayMap', () => {
  it('확인된 좌표의 활성 항목만 순번 마커로 만들고, 미확인·제외 항목은 마커에서 뺀다', () => {
    const m = buildDayMap(trip(), '2026-05-01');
    const stops = m.markers.filter((x) => x.kind === 'stop');
    expect(stops.map((x) => [x.id, x.number])).toEqual([
      ['s1', 1],
      ['s3', 3],
    ]);
    expect(m.unverifiedActiveCount).toBe(1); // 점심(순번 2)은 좌표 없음
    expect(m.excludedCount).toBe(1);
  });

  it('순번은 지도에 없는 항목을 건너뛰지 않고 일정 순번과 같다', () => {
    const m = buildDayMap(trip(), '2026-05-01');
    expect(m.markers.find((x) => x.id === 's3')?.number).toBe(3);
  });

  it('그날 밤 숙소와 그날 체크아웃 숙소를 숙소 마커로 표시하고 좌표 없는 숙소는 미확인으로 센다', () => {
    const d1 = buildDayMap(trip(), '2026-05-01');
    expect(d1.markers.filter((x) => x.kind === 'stay').map((x) => x.id)).toEqual(['A']);
    expect(d1.markers.find((x) => x.id === 'A')?.title).toBe('A 호텔');
    const d2 = buildDayMap(trip(), '2026-05-02');
    // 5/2: A 체크아웃(좌표 있음), B 체크인(좌표 없음)
    expect(d2.markers.filter((x) => x.kind === 'stay').map((x) => x.id)).toEqual(['A']);
    expect(d2.unverifiedStayCount).toBe(1);
  });

  it('안내선은 순번 마커 좌표를 순서대로 잇고, 마커가 2개 미만이면 없다', () => {
    const m = buildDayMap(trip(), '2026-05-01');
    expect(m.guideLine).toEqual([anmok, ojukheon]);
    expect(buildDayMap(trip(), '2026-05-03').guideLine).toEqual([]);
  });

  it('마커가 없으면 bounds가 null이고, 있으면 모든 마커를 포함한다', () => {
    expect(buildDayMap(trip(), '2026-05-03').bounds).toBeNull();
    const b = buildDayMap(trip(), '2026-05-01').bounds!;
    expect(b.south).toBeLessThanOrEqual(37.7519);
    expect(b.north).toBeGreaterThanOrEqual(37.7793);
    expect(b.west).toBeLessThanOrEqual(128.8761);
    expect(b.east).toBeGreaterThanOrEqual(128.9475);
  });
});

describe('buildStaysMap', () => {
  it('확인된 좌표의 숙박만 숙소 마커로 만들고 안내선은 없다', async () => {
    const { buildStaysMap } = await import('./map-markers');
    const m = buildStaysMap(trip());
    expect(m.markers.map((x) => [x.id, x.kind])).toEqual([['A', 'stay']]);
    expect(m.unverifiedStayCount).toBe(1);
    expect(m.guideLine).toEqual([]);
    expect(m.bounds).toEqual({ south: gangneungA.lat, north: gangneungA.lat, west: gangneungA.lng, east: gangneungA.lng });
  });
});

describe('overlappingStayIds', () => {
  it('순번 마커와 같은 좌표의 숙소 마커만 골라낸다', async () => {
    const { overlappingStayIds } = await import('./map-markers');
    const t = trip();
    t.stays[0] = { ...t.stays[0], location: anmok };
    const m = buildDayMap(t, '2026-05-01');
    expect([...overlappingStayIds(m.markers)]).toEqual(['A']);
    expect([...overlappingStayIds(buildDayMap(trip(), '2026-05-01').markers)]).toEqual([]);
  });
});
