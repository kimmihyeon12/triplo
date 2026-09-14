import { describe, expect, it } from 'vitest';
import { createRegion, createStop, createTrip } from './factories';
import {
  daySegments,
  dayStops,
  dayTotals,
  fixedTimeConflicts,
  formatMinutes,
  haversineKm,
  moveStop,
  placeStopOnDate,
  sortDayByNearest,
  unassignedStops,
} from './itinerary';

const gangneung = createRegion('강릉', 0, 'r1');
const sokcho = createRegion('속초', 1, 'r2');

function trip() {
  return createTrip({
    startDate: '2026-05-01',
    endDate: '2026-05-02',
    regions: [gangneung, sokcho],
    stops: [
      createStop({
        id: 's1',
        name: '안목해변',
        date: '2026-05-01',
        order: 0,
        regionId: 'r1',
        stayMinutes: 60,
      }),
      createStop({
        id: 's2',
        name: '점심',
        kind: 'meal',
        date: '2026-05-01',
        order: 1,
        stayMinutes: 60,
      }),
      createStop({
        id: 's3',
        name: '속초 중앙시장',
        date: '2026-05-01',
        order: 2,
        regionId: 'r2',
        stayMinutes: 90,
      }),
      createStop({
        id: 's4',
        name: '제외됨',
        date: '2026-05-01',
        order: 3,
        stayMinutes: 30,
        excluded: true,
      }),
      createStop({ id: 'u1', name: '미배치 카페', date: null, order: 0 }),
    ],
  });
}

describe('itinerary', () => {
  it('dayStops는 날짜의 항목을 순서대로, unassignedStops는 미배치를 돌려준다', () => {
    expect(dayStops(trip(), '2026-05-01').map((s) => s.id)).toEqual(['s1', 's2', 's3', 's4']);
    expect(dayStops(trip(), '2026-05-02')).toEqual([]);
    expect(unassignedStops(trip()).map((s) => s.id)).toEqual(['u1']);
  });

  it('moveStop은 같은 날짜 안에서 위·아래로 교환하고 끝에서는 그대로 둔다', () => {
    const up = moveStop(trip(), 's2', 'up');
    expect(dayStops(up, '2026-05-01').map((s) => s.id)).toEqual(['s2', 's1', 's3', 's4']);
    const down = moveStop(trip(), 's2', 'down');
    expect(dayStops(down, '2026-05-01').map((s) => s.id)).toEqual(['s1', 's3', 's2', 's4']);
    const top = moveStop(trip(), 's1', 'up');
    expect(dayStops(top, '2026-05-01').map((s) => s.id)).toEqual(['s1', 's2', 's3', 's4']);
    expect(moveStop(trip(), 'u1', 'up').stops).toEqual(trip().stops);
  });

  it('placeStopOnDate는 항목을 다른 날짜의 마지막 순서로 옮긴다', () => {
    const t = placeStopOnDate(trip(), 'u1', '2026-05-02');
    expect(dayStops(t, '2026-05-02').map((s) => s.id)).toEqual(['u1']);
    const t2 = placeStopOnDate(t, 's1', '2026-05-02');
    expect(dayStops(t2, '2026-05-02').map((s) => s.id)).toEqual(['u1', 's1']);
    expect(dayStops(t2, '2026-05-01').map((s) => s.order)).toEqual([0, 1, 2]);
    const t3 = placeStopOnDate(t2, 's2', null);
    expect(unassignedStops(t3).map((s) => s.id)).toEqual(['s2']);
  });

  it('dayTotals: 제외 항목을 빼고 체류를 합산하며 이동은 미확인 구간 수로만 센다', () => {
    const totals = dayTotals(trip(), '2026-05-01');
    expect(totals).toEqual({
      stayMinutes: 210,
      activeCount: 3,
      unknownStayCount: 0,
      legCount: 2,
      unknownLegCount: 2,
    });
    expect(dayTotals(trip(), '2026-05-02')).toEqual({
      stayMinutes: 0,
      activeCount: 0,
      unknownStayCount: 0,
      legCount: 0,
      unknownLegCount: 0,
    });
  });

  it('daySegments: 지역이 바뀌는 구간을 한 번만 표시한다', () => {
    const segs = daySegments(trip(), '2026-05-01');
    expect(segs.map((s) => s.type)).toEqual(['stop', 'leg', 'stop', 'leg', 'stop', 'stop']);
    const legs = segs.filter((s) => s.type === 'leg');
    expect(legs[0]).toMatchObject({ fromRegion: '강릉', toRegion: null, regionChange: false });
    expect(legs[1]).toMatchObject({ fromRegion: '강릉', toRegion: '속초', regionChange: true });
  });

  it('fixedTimeConflicts: 앞 항목의 고정 시각이 뒤 항목보다 늦으면 충돌', () => {
    const t = createTrip({
      startDate: '2026-05-01',
      endDate: '2026-05-01',
      stops: [
        createStop({
          id: 'a',
          name: '예약 식당',
          date: '2026-05-01',
          order: 0,
          fixedTime: '13:00',
        }),
        createStop({ id: 'b', name: '전시', date: '2026-05-01', order: 1, fixedTime: '11:00' }),
        createStop({ id: 'c', name: '카페', date: '2026-05-01', order: 2 }),
      ],
    });
    expect(fixedTimeConflicts(t, '2026-05-01')).toEqual([{ earlierId: 'a', laterId: 'b' }]);
    expect(fixedTimeConflicts(trip(), '2026-05-01')).toEqual([]);
  });

  it('formatMinutes는 시간·분으로 표시한다', () => {
    expect(formatMinutes(0)).toBe('0분');
    expect(formatMinutes(45)).toBe('45분');
    expect(formatMinutes(60)).toBe('1시간');
    expect(formatMinutes(210)).toBe('3시간 30분');
  });
});

describe('haversineKm', () => {
  it('같은 지점은 0km다', () => {
    expect(haversineKm({ lat: 37.5, lng: 127.0 }, { lat: 37.5, lng: 127.0 })).toBe(0);
  });

  it('서울과 부산 사이는 약 325km다', () => {
    const km = haversineKm({ lat: 37.5665, lng: 126.978 }, { lat: 35.1796, lng: 129.0756 });
    expect(km).toBeGreaterThan(310);
    expect(km).toBeLessThan(340);
  });

  it('거리는 순서를 바꿔도 같다', () => {
    const a = { lat: 37.5, lng: 127.0 };
    const b = { lat: 35.2, lng: 129.1 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 6);
  });
});

describe('sortDayByNearest', () => {
  /** 강릉 일대의 실제 좌표. 안목해변에서 경포대·주문진 순으로 멀어진다. */
  const anmok = { lat: 37.7726, lng: 128.9472 };
  const gyeongpo = { lat: 37.7954, lng: 128.8963 };
  const jumunjin = { lat: 37.8931, lng: 128.8302 };

  it('첫 항목에서 출발해 가까운 곳부터 잇는다', () => {
    const t = createTrip({
      startDate: '2026-05-01',
      endDate: '2026-05-01',
      stops: [
        createStop({ id: 'a', name: '안목해변', date: '2026-05-01', order: 0, location: anmok }),
        createStop({ id: 'c', name: '주문진', date: '2026-05-01', order: 1, location: jumunjin }),
        createStop({ id: 'b', name: '경포대', date: '2026-05-01', order: 2, location: gyeongpo }),
      ],
    });
    const r = sortDayByNearest(t, '2026-05-01');
    expect(dayStops(r.trip, '2026-05-01').map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(r.sortedCount).toBe(3);
  });

  it('고정 시각 항목은 자리를 지키고 나머지만 재배열한다', () => {
    const t = createTrip({
      startDate: '2026-05-01',
      endDate: '2026-05-01',
      stops: [
        createStop({ id: 'a', name: '안목해변', date: '2026-05-01', order: 0, location: anmok }),
        createStop({
          id: 'fixed',
          name: '예약 식당',
          date: '2026-05-01',
          order: 1,
          fixedTime: '12:00',
          location: jumunjin,
        }),
        createStop({ id: 'c', name: '주문진', date: '2026-05-01', order: 2, location: jumunjin }),
        createStop({ id: 'b', name: '경포대', date: '2026-05-01', order: 3, location: gyeongpo }),
      ],
    });
    const r = sortDayByNearest(t, '2026-05-01');
    const ids = dayStops(r.trip, '2026-05-01').map((s) => s.id);
    // 예약 식당은 두 번째 자리를 그대로 지킨다
    expect(ids[1]).toBe('fixed');
    // 나머지 세 자리는 안목 → 경포 → 주문진 순으로 채워진다
    expect([ids[0], ids[2], ids[3]]).toEqual(['a', 'b', 'c']);
    expect(r.fixedCount).toBe(1);
    expect(r.sortedCount).toBe(3);
  });

  it('좌표 없는 항목은 자리를 지키고 개수를 알려준다', () => {
    const t = createTrip({
      startDate: '2026-05-01',
      endDate: '2026-05-01',
      stops: [
        createStop({ id: 'a', name: '안목해변', date: '2026-05-01', order: 0, location: anmok }),
        createStop({ id: 'none', name: '위치 미확인', date: '2026-05-01', order: 1 }),
        createStop({ id: 'c', name: '주문진', date: '2026-05-01', order: 2, location: jumunjin }),
        createStop({ id: 'b', name: '경포대', date: '2026-05-01', order: 3, location: gyeongpo }),
      ],
    });
    const r = sortDayByNearest(t, '2026-05-01');
    const ids = dayStops(r.trip, '2026-05-01').map((s) => s.id);
    expect(ids[1]).toBe('none');
    expect(r.unlocatedCount).toBe(1);
    expect(r.sortedCount).toBe(3);
  });

  it('정렬할 항목이 두 개 미만이면 그대로 둔다', () => {
    const t = createTrip({
      startDate: '2026-05-01',
      endDate: '2026-05-01',
      stops: [
        createStop({ id: 'a', name: '안목해변', date: '2026-05-01', order: 0, location: anmok }),
        createStop({ id: 'none', name: '위치 미확인', date: '2026-05-01', order: 1 }),
      ],
    });
    const r = sortDayByNearest(t, '2026-05-01');
    expect(dayStops(r.trip, '2026-05-01').map((s) => s.id)).toEqual(['a', 'none']);
    expect(r.sortedCount).toBe(1);
  });

  it('다른 날짜의 항목은 건드리지 않는다', () => {
    const t = createTrip({
      startDate: '2026-05-01',
      endDate: '2026-05-02',
      stops: [
        createStop({ id: 'a', name: '안목해변', date: '2026-05-01', order: 0, location: anmok }),
        createStop({ id: 'c', name: '주문진', date: '2026-05-01', order: 1, location: jumunjin }),
        createStop({ id: 'b', name: '경포대', date: '2026-05-01', order: 2, location: gyeongpo }),
        createStop({
          id: 'next',
          name: '둘째날',
          date: '2026-05-02',
          order: 0,
          location: jumunjin,
        }),
      ],
    });
    const r = sortDayByNearest(t, '2026-05-01');
    expect(dayStops(r.trip, '2026-05-02').map((s) => s.id)).toEqual(['next']);
  });
});
