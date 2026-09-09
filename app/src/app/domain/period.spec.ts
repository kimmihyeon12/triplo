import { describe, expect, it } from 'vitest';
import { createRegion, createStay, createStop, createTrip } from './model';
import { applyPeriodChange, periodChangeImpact, regionRemovalImpact, removeRegion } from './period';

function trip() {
  return createTrip({
    startDate: '2026-05-01',
    endDate: '2026-05-04',
    regions: [createRegion('강릉', 0, 'r1'), createRegion('속초', 1, 'r2')],
    stops: [
      createStop({ id: 's1', name: '1일차', date: '2026-05-01', order: 0, regionId: 'r1' }),
      createStop({ id: 's3', name: '3일차', date: '2026-05-03', order: 0, regionId: 'r2' }),
      createStop({ id: 's4', name: '4일차', date: '2026-05-04', order: 0, regionId: 'r2' }),
      createStop({ id: 'u1', name: '미배치', date: null, order: 0 }),
    ],
    stays: [
      createStay({ id: 'A', name: 'A', checkIn: '2026-05-01', checkOut: '2026-05-03', regionId: 'r1' }),
      createStay({ id: 'B', name: 'B', checkIn: '2026-05-03', checkOut: '2026-05-04', regionId: 'r2' }),
    ],
  });
}

describe('period', () => {
  it('periodChangeImpact: 기간 단축 시 밀려나는 장소와 기간 밖 숙박을 보고한다', () => {
    const impact = periodChangeImpact(trip(), '2026-05-01', '2026-05-02');
    expect(impact.displacedStops.map((s) => s.id)).toEqual(['s3', 's4']);
    expect(impact.outOfRangeStays.map((s) => s.id)).toEqual(['A', 'B']);
    expect(impact.hasImpact).toBe(true);
  });

  it('periodChangeImpact: 기간 연장이나 동일 기간은 영향이 없다', () => {
    expect(periodChangeImpact(trip(), '2026-05-01', '2026-05-06').hasImpact).toBe(false);
    expect(periodChangeImpact(trip(), '2026-05-01', '2026-05-04').hasImpact).toBe(false);
  });

  it('periodChangeImpact: 날짜 미정으로 바꾸면 모든 배치 장소가 미배치 대상이다', () => {
    const impact = periodChangeImpact(trip(), null, null);
    expect(impact.displacedStops.map((s) => s.id)).toEqual(['s1', 's3', 's4']);
    expect(impact.outOfRangeStays).toEqual([]);
  });

  it('applyPeriodChange: 장소는 미배치로 보존하고 숙박은 삭제하지 않는다', () => {
    const next = applyPeriodChange(trip(), '2026-05-01', '2026-05-02');
    expect(next.startDate).toBe('2026-05-01');
    expect(next.endDate).toBe('2026-05-02');
    expect(next.stops).toHaveLength(4);
    expect(next.stops.find((s) => s.id === 's3')?.date).toBeNull();
    expect(next.stops.find((s) => s.id === 's4')?.date).toBeNull();
    expect(next.stops.find((s) => s.id === 's1')?.date).toBe('2026-05-01');
    expect(next.stays).toHaveLength(2);
  });

  it('regionRemovalImpact·removeRegion: 참조만 해제하고 항목을 보존한다', () => {
    const impact = regionRemovalImpact(trip(), 'r2');
    expect(impact.stopCount).toBe(2);
    expect(impact.stayCount).toBe(1);
    const next = removeRegion(trip(), 'r2');
    expect(next.regions.map((r) => r.id)).toEqual(['r1']);
    expect(next.stops).toHaveLength(4);
    expect(next.stops.find((s) => s.id === 's3')?.regionId).toBeNull();
    expect(next.stays.find((s) => s.id === 'B')?.regionId).toBeNull();
  });
});
