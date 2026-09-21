import { describe, expect, it } from 'vitest';
import type { Trip } from '../../trips/model/trip';
import { tallyVisits } from './visit-tally';
import { mappedTotal } from './visit-total';

const TODAY = '2026-09-21';

function trip(id: string, region: { name: string; code?: string } | null, names: string[]): Trip {
  return {
    id, title: `${id} 여행`, startDate: '2024-05-01', endDate: '2024-05-03',
    regions: region ? [{ id: 'r1', name: region.name, regionCode: region.code, order: 0 }] : [],
    stops: names.map((n, i) => ({
      id: `${id}-s${i}`, name: n, address: '', regionId: region ? 'r1' : null, kind: 'place',
      excluded: false, location: null, date: '2024-05-01', order: i,
      stayMinutes: null, memo: '', fixedTime: null, locationStatus: 'unverified', placeRef: null,
    })),
    stays: [],
  } as unknown as Trip;
}

describe('mappedTotal', () => {
  it('지도에 올린 장소만 센다', () => {
    const summary = tallyVisits([trip('t1', { name: '서울', code: 'seoul' }, ['a', 'b'])], TODAY);
    expect(mappedTotal(summary)).toBe(2);
  });

  it('지역을 분류하지 못한 장소는 빼고 센다', () => {
    const trips = [
      trip('t1', { name: '서울', code: 'seoul' }, ['a', 'b']),
      trip('t2', null, ['c', 'd', 'e']),
    ];
    const summary = tallyVisits(trips, TODAY);
    expect(summary.totalPlaces).toBe(5);
    expect(summary.unclassifiedCount).toBe(3);
    // 화면이 보여주는 값은 지도에 올라간 2곳이어야 한다.
    expect(mappedTotal(summary)).toBe(2);
  });

  it('지역별 합계와 항상 같다', () => {
    const trips = [
      trip('t1', { name: '서울', code: 'seoul' }, ['a', 'b']),
      trip('t2', { name: '부산', code: 'busan' }, ['c']),
      trip('t3', null, ['d']),
    ];
    const summary = tallyVisits(trips, TODAY);
    const sum = summary.regions.reduce((acc, r) => acc + r.visitCount, 0);
    expect(mappedTotal(summary)).toBe(sum);
  });

  it('모두 분류하지 못하면 0이다', () => {
    const summary = tallyVisits([trip('t1', null, ['a', 'b'])], TODAY);
    expect(mappedTotal(summary)).toBe(0);
  });

  /*
    '다녀온 시·도 0곳'인데 '누적 1곳'은 모순이다. 방문한 곳이 있으면 그
    지역도 세어져 있어야 한다(2026-09-21 광주 사례). 둘 중 하나만 0이 되는
    일이 없도록 관계를 고정한다.
  */
  it('지역 수가 0이면 누적도 0이다', () => {
    const cases: Trip[][] = [
      [trip('t1', null, ['a'])],
      [trip('t1', null, ['a', 'b']), trip('t2', null, ['c'])],
      [],
    ];
    for (const trips of cases) {
      const summary = tallyVisits(trips, TODAY);
      if (summary.regions.length === 0) expect(mappedTotal(summary)).toBe(0);
    }
  });

  it('누적이 0보다 크면 지역도 하나 이상이다', () => {
    const summary = tallyVisits([
      trip('t1', { name: '광주광역시' }, ['죽녹원']),
      trip('t2', null, ['어딘가']),
    ], TODAY);
    expect(mappedTotal(summary)).toBeGreaterThan(0);
    expect(summary.regions.length).toBeGreaterThan(0);
  });
});
