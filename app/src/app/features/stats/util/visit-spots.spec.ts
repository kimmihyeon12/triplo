import { describe, expect, it } from 'vitest';
import type { Trip } from '../../trips/model/trip';
import { visitSpots } from './visit-spots';

const TODAY = '2026-09-21';

/**
 * 시험용 여행 하나. 여행 지역은 '여수시'로 두고 장소마다 주소를 달리 준다.
 * 자리는 여행 지역이 아니라 주소로 정해진다(util/item-province).
 */
function trip(id: string, stops: { name: string; lat?: number; lng?: number; address?: string }[]): Trip {
  return {
    id, title: `${id} 여행`, startDate: '2024-05-01', endDate: '2024-05-03',
    regions: [{ id: 'r1', name: '여수시', regionCode: '12_여수시', order: 0 }],
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
    const got = visitSpots([trip('t', [
      { name: '금성관', lat: 35.03, lng: 126.71, address: '전라남도 나주시 금성관길 8' },
    ])], TODAY);
    expect(got).toEqual([
      { regionCode: '12_나주시', name: '나주시', location: { lat: 35.03, lng: 126.71 }, count: 1 },
    ]);
  });

  /*
    나주와 순천은 다른 시다. 예전에는 둘 다 '전남' 한 자리로 묶여 아무도 가지
    않은 중간에 찍혔다. 지도가 시·군·구 단위가 되면서 각자의 자리를 가진다.
  */
  it('시가 다르면 따로 센다', () => {
    const got = visitSpots([trip('t', [
      { name: '금성관', lat: 35.03, lng: 126.71, address: '전라남도 나주시 금성관길 8' },
      { name: '순천만', lat: 34.95, lng: 127.49, address: '전라남도 순천시 순천만길 513' },
    ])], TODAY);
    expect(got.map(s => s.regionCode).sort()).toEqual(['12_나주시', '12_순천시']);
  });

  it('같은 시의 여러 장소는 한 자리로 모은다', () => {
    const got = visitSpots([trip('t', [
      { name: '오동도', lat: 34.7400, lng: 127.7500, address: '전라남도 여수시 오동도로 222' },
      { name: '해상케이블카', lat: 34.7430, lng: 127.7480, address: '전라남도 여수시 오동도로 3' },
    ])], TODAY);
    expect(got).toHaveLength(1);
    expect(got[0].regionCode).toBe('12_여수시');
    expect(got[0].count).toBe(2);
  });

  it('주소가 없으면 여행 지역을 쓴다', () => {
    const got = visitSpots([trip('t', [{ name: '어딘가', lat: 34.74, lng: 127.75 }])], TODAY);
    expect(got).toEqual([
      { regionCode: '12_여수시', name: '여수시', location: { lat: 34.74, lng: 127.75 }, count: 1 },
    ]);
  });

  it('좌표가 없는 장소는 넣지 않는다', () => {
    expect(visitSpots([trip('t', [{ name: '어딘가' }])], TODAY)).toEqual([]);
  });

  it('끝나지 않은 여행은 세지 않는다', () => {
    const future = { ...trip('t', [{ name: '오동도', lat: 34.74, lng: 127.75 }]), endDate: '2030-01-01' } as Trip;
    expect(visitSpots([future], TODAY)).toEqual([]);
  });

  it('말이 되지 않는 좌표는 버린다', () => {
    const got = visitSpots([trip('t', [
      { name: '이상한 곳', lat: 999, lng: 999, address: '전라남도 여수시 오동도로 222' },
    ])], TODAY);
    expect(got).toEqual([]);
  });

  it('여러 여행의 같은 자리를 합친다', () => {
    const got = visitSpots([
      trip('a', [{ name: '오동도', lat: 34.7400, lng: 127.7500, address: '전라남도 여수시 오동도로 222' }]),
      trip('b', [{ name: '진남관', lat: 34.7420, lng: 127.7420, address: '전라남도 여수시 동문로 11' }]),
    ], TODAY);
    expect(got).toHaveLength(1);
    expect(got[0].count).toBe(2);
  });

  it('자리 이름은 행정구역 이름이다', () => {
    const got = visitSpots([trip('t', [
      { name: '화엄사', lat: 35.2334, lng: 127.4931, address: '전라남도 구례군 마산면 화엄사로 539' },
    ])], TODAY);
    expect(got[0].name).toBe('구례군');
  });
});
