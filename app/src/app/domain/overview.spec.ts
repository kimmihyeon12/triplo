import { describe, expect, it } from 'vitest';
import { createRegion, createStay, createStop, createTrip } from './model';
import { buildOverview } from './overview';

function trip() {
  return createTrip({
    title: '강릉 속초',
    startDate: '2026-05-01',
    endDate: '2026-05-04',
    regions: [createRegion('강릉', 0, 'r1'), createRegion('속초', 1, 'r2')],
    stops: [
      createStop({ id: 's1', name: '안목해변', date: '2026-05-01', order: 0, regionId: 'r1', stayMinutes: 60 }),
      createStop({ id: 's2', name: '오죽헌', date: '2026-05-01', order: 1, regionId: 'r1', stayMinutes: 60 }),
      createStop({ id: 's3', name: '강릉 카페', date: '2026-05-03', order: 0, regionId: 'r1' }),
      createStop({ id: 's4', name: '속초 시장', date: '2026-05-03', order: 1, regionId: 'r2' }),
      createStop({ id: 'u1', name: '미배치', date: null, order: 0 }),
    ],
    stays: [
      createStay({ id: 'A', name: 'A 숙소', checkIn: '2026-05-01', checkOut: '2026-05-03', regionId: 'r1' }),
      createStay({ id: 'B', name: 'B 숙소', checkIn: '2026-05-03', checkOut: '2026-05-04', regionId: 'r2' }),
    ],
  });
}

describe('overview', () => {
  it('날짜별 요약: 일차·지역·주요 일정·숙소 상태', () => {
    const ov = buildOverview(trip());
    expect(ov.undecidedDates).toBe(false);
    expect(ov.days).toHaveLength(4);
    expect(ov.days[0]).toMatchObject({ dayNumber: 1, date: '2026-05-01', regionNames: ['강릉'], stopNames: ['안목해변', '오죽헌'], nightLabel: 'A 숙소 체크인', nightState: 'covered' });
    expect(ov.days[1]).toMatchObject({ dayNumber: 2, regionNames: [], stopNames: [], nightLabel: 'A 숙소 연박', nightState: 'covered' });
    expect(ov.days[2]).toMatchObject({ dayNumber: 3, regionNames: ['강릉', '속초'], nightLabel: 'A 숙소 체크아웃 → B 숙소 체크인', regionChangeCount: 1 });
    expect(ov.days[3]).toMatchObject({ dayNumber: 4, nightLabel: '귀가일', nightState: 'none' });
  });

  it('미배치 목록과 확인 필요 항목을 모은다', () => {
    const ov = buildOverview(trip());
    expect(ov.unassigned.map((s) => s.id)).toEqual(['u1']);
    expect(ov.issues.map((i) => i.kind)).toEqual(expect.arrayContaining(['unverified-location']));
    expect(ov.issues.find((i) => i.kind === 'unverified-location')?.count).toBe(7);
  });

  it('숙소 미정인 밤과 충돌을 issues에 넣는다', () => {
    const t = trip();
    t.stays = [createStay({ id: 'A', name: 'A', checkIn: '2026-05-01', checkOut: '2026-05-02' }), createStay({ id: 'C', name: 'C', checkIn: '2026-05-01', checkOut: '2026-05-03' })];
    const ov = buildOverview(t);
    expect(ov.days[0].nightState).toBe('conflict');
    expect(ov.days[2].nightState).toBe('undecided');
    expect(ov.days[2].nightLabel).toBe('C 체크아웃 · 숙소 미정');
    expect(ov.issues.find((i) => i.kind === 'stay-conflict')?.count).toBe(1);
    expect(ov.issues.find((i) => i.kind === 'night-undecided')?.count).toBe(1);
  });

  it('날짜 미정 여행은 days가 비고 미배치만 있다', () => {
    const ov = buildOverview(createTrip({ stops: [createStop({ id: 'x', name: 'x' })] }));
    expect(ov.undecidedDates).toBe(true);
    expect(ov.days).toEqual([]);
    expect(ov.unassigned).toHaveLength(1);
  });
});
