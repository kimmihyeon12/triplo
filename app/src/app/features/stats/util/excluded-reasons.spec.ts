import { describe, expect, it } from 'vitest';
import type { Trip } from '../../trips/model/trip';
import { excludedReasons } from './excluded-reasons';

function trip(over: Partial<Trip> = {}): Trip {
  return {
    id: 't1',
    title: '여행',
    startDate: '2024-05-01',
    endDate: '2024-05-03',
    regions: [{ id: 'r1', name: '강릉', regionCode: 'gangwon-gangneung' }],
    stops: [
      { id: 's1', name: '안목해변', address: '강원 강릉시', regionId: 'r1', kind: 'place',
        excluded: false, location: null, date: '2024-05-01' },
    ],
    stays: [],
    ...over,
  } as unknown as Trip;
}

const TODAY = '2026-09-21';

describe('excludedReasons', () => {
  it('집계된 여행은 아무 이유도 내지 않는다', () => {
    expect(excludedReasons([trip()], TODAY)).toEqual({
      notEnded: 0, noEndDate: 0, noRegion: 0, emptyItinerary: 0,
    });
  });

  it('종료일이 아직 지나지 않은 여행을 센다', () => {
    const future = trip({ endDate: '2030-01-01' } as Partial<Trip>);
    expect(excludedReasons([future], TODAY).notEnded).toBe(1);
  });

  it('종료일이 오늘인 여행도 아직 끝나지 않은 것으로 본다', () => {
    const today = trip({ endDate: TODAY } as Partial<Trip>);
    expect(excludedReasons([today], TODAY).notEnded).toBe(1);
  });

  it('종료일이 없는 여행을 따로 센다', () => {
    const open = trip({ endDate: null } as Partial<Trip>);
    expect(excludedReasons([open], TODAY).noEndDate).toBe(1);
  });

  it('지역이 연결되지 않은 장소만 있는 여행을 센다', () => {
    const noRegion = trip({
      stops: [{ id: 's1', name: '어딘가', address: '', regionId: null, kind: 'place',
        excluded: false, location: null, date: '2024-05-01' }],
    } as unknown as Partial<Trip>);
    expect(excludedReasons([noRegion], TODAY).noRegion).toBe(1);
  });

  it('담긴 장소와 숙소가 없는 여행을 센다', () => {
    const empty = trip({ stops: [], stays: [] } as unknown as Partial<Trip>);
    expect(excludedReasons([empty], TODAY).emptyItinerary).toBe(1);
  });

  it('제외 처리한 장소만 있으면 빈 일정으로 센다', () => {
    const allExcluded = trip({
      stops: [{ id: 's1', name: '취소', address: '강원 강릉시', regionId: 'r1', kind: 'place',
        excluded: true, location: null, date: '2024-05-01' }],
    } as unknown as Partial<Trip>);
    expect(excludedReasons([allExcluded], TODAY).emptyItinerary).toBe(1);
  });

  it('여러 여행의 이유를 각각 더한다', () => {
    const list = [
      trip(),
      trip({ id: 't2', endDate: '2030-01-01' } as Partial<Trip>),
      trip({ id: 't3', endDate: null } as Partial<Trip>),
      trip({ id: 't4', stops: [], stays: [] } as unknown as Partial<Trip>),
    ];
    expect(excludedReasons(list, TODAY)).toEqual({
      notEnded: 1, noEndDate: 1, noRegion: 0, emptyItinerary: 1,
    });
  });
});
