import { describe, expect, it } from 'vitest';
import { createRegion, createStop, createTrip } from './model';
import {
  daySegments,
  dayStops,
  dayTotals,
  fixedTimeConflicts,
  formatMinutes,
  moveStop,
  placeStopOnDate,
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
      createStop({ id: 's1', name: '안목해변', date: '2026-05-01', order: 0, regionId: 'r1', stayMinutes: 60 }),
      createStop({ id: 's2', name: '점심', kind: 'meal', date: '2026-05-01', order: 1, stayMinutes: 60 }),
      createStop({ id: 's3', name: '속초 중앙시장', date: '2026-05-01', order: 2, regionId: 'r2', stayMinutes: 90 }),
      createStop({ id: 's4', name: '제외됨', date: '2026-05-01', order: 3, stayMinutes: 30, excluded: true }),
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
    expect(totals).toEqual({ stayMinutes: 210, activeCount: 3, unknownStayCount: 0, legCount: 2, unknownLegCount: 2 });
    expect(dayTotals(trip(), '2026-05-02')).toEqual({ stayMinutes: 0, activeCount: 0, unknownStayCount: 0, legCount: 0, unknownLegCount: 0 });
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
        createStop({ id: 'a', name: '예약 식당', date: '2026-05-01', order: 0, fixedTime: '13:00' }),
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
