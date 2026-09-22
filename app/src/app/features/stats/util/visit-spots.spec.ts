import { describe, expect, it } from 'vitest';
import type { Trip } from '../../trips/model/trip';
import { visitSpots } from './visit-spots';

const TODAY = '2026-09-21';

function trip(id: string, stops: { name: string; lat?: number; lng?: number; address?: string }[]): Trip {
  return {
    id, title: `${id} 여행`, startDate: '2024-05-01', endDate: '2024-05-03',
    regions: [{ id: 'r1', name: '전남', regionCode: 'jeonnam', order: 0 }],
    stops: stops.map((s, i) => ({
      id: `${id}-${i}`, name: s.name, address: s.address ?? '', regionId: 'r1', kind: 'place',
      excluded: false, date: '2024-05-01', order: i, stayMinutes: null, memo: '',
      fixedTime: null, placeRef: null,
      locationStatus: s.lat === undefined ? 'unverified' : 'verified',
      location: s.lat === undefined ? null : { lat: s.lat, lng: s.lng! },
    })),
    stays: [],
  } as unknown as Trip;
}

describe('visitSpots', () => {
  it('좌표가 있는 방문지를 낸다', () => {
    const got = visitSpots([trip('t', [{ name: '나주', lat: 35.03, lng: 126.71 }])], TODAY);
    expect(got).toEqual([{ regionCode: 'jeonnam', name: '전남', location: { lat: 35.03, lng: 126.71 }, count: 1 }]);
  });

  /*
    나주와 순천은 둘 다 전남이지만 실제 위치가 멀다. 하나로 합치면 아무도
    가지 않은 중간에 찍힌다. 좌표가 다르면 따로 센다(2026-09-21 결정).
  */
  it('같은 시·도라도 자리가 다르면 따로 센다', () => {
    const got = visitSpots([trip('t', [
      { name: '나주', lat: 35.03, lng: 126.71 },
      { name: '순천', lat: 34.95, lng: 127.49 },
    ])], TODAY);
    expect(got).toHaveLength(2);
    expect(got.every((s) => s.regionCode === 'jeonnam')).toBe(true);
  });

  it('가까운 곳은 한 자리로 모은다', () => {
    // 같은 동네 안의 두 장소. 따로 찍으면 지도에서 겹쳐 보인다.
    const got = visitSpots([trip('t', [
      { name: '오동도', lat: 34.7400, lng: 127.7500 },
      { name: '해상케이블카', lat: 34.7430, lng: 127.7480 },
    ])], TODAY);
    expect(got).toHaveLength(1);
    expect(got[0].count).toBe(2);
  });

  it('좌표가 없는 장소는 넣지 않는다', () => {
    expect(visitSpots([trip('t', [{ name: '어딘가' }])], TODAY)).toEqual([]);
  });

  it('끝나지 않은 여행은 세지 않는다', () => {
    const future = { ...trip('t', [{ name: '나주', lat: 35.03, lng: 126.71 }]), endDate: '2030-01-01' } as Trip;
    expect(visitSpots([future], TODAY)).toEqual([]);
  });

  it('말이 되지 않는 좌표는 버린다', () => {
    const bad = trip('t', [
      { name: 'NaN', lat: NaN, lng: 127 },
      { name: '범위 밖', lat: 91, lng: 127 },
      { name: '정상', lat: 35.03, lng: 126.71 },
    ]);
    expect(visitSpots([bad], TODAY)).toHaveLength(1);
  });

  it('여러 여행의 같은 자리를 합친다', () => {
    const got = visitSpots([
      trip('a', [{ name: '나주', lat: 35.03, lng: 126.71 }]),
      trip('b', [{ name: '나주 again', lat: 35.03, lng: 126.71 }]),
    ], TODAY);
    expect(got).toHaveLength(1);
    expect(got[0].count).toBe(2);
  });
});

/*
  마커에 '전남'만 적으면 나주와 순천을 구분할 수 없다. 자리마다 주소에서
  읽은 시·군 이름을 붙인다(2026-09-21 결정).
*/
describe('visitSpots 이름', () => {
  it('자리마다 시·군 이름을 붙인다', () => {
    const got = visitSpots([trip('t', [
      { name: '영산포', lat: 35.016, lng: 126.711, address: '전남 나주시 영산동' },
      { name: '순천만', lat: 34.885, lng: 127.509, address: '전남 순천시 대대동' },
    ])], TODAY);
    expect(got.map((s) => s.name).sort()).toEqual(['나주', '순천']);
  });

  it('주소를 읽을 수 없으면 시·도 이름을 쓴다', () => {
    const got = visitSpots([trip('t', [{ name: '어딘가', lat: 35, lng: 127, address: '' }])], TODAY);
    expect(got[0].name).toBe('전남');
  });

  it('모인 자리는 첫 장소의 이름을 쓴다', () => {
    const got = visitSpots([trip('t', [
      { name: '오동도', lat: 34.7400, lng: 127.7500, address: '전남 여수시 수정동' },
      { name: '케이블카', lat: 34.7430, lng: 127.7480, address: '전남 여수시 자산공원길' },
    ])], TODAY);
    expect(got).toHaveLength(1);
    expect(got[0].name).toBe('여수');
  });
});
