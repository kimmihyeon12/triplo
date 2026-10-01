import { describe, expect, it } from 'vitest';
import type { NearbyPlace } from '../../places/model/map';
import { createStop, createTrip } from './factories';
import { addNearbyStop, isInTrip, toPins } from './map-explore';

const place = (over: Partial<NearbyPlace> = {}): NearbyPlace => ({
  provider: 'kakao',
  id: 'k1',
  name: '테스트 순두부',
  address: '강원 강릉시 초당동 1',
  roadAddress: '강원 강릉시 초당순두부길 77',
  lat: 37.7905,
  lng: 128.9135,
  category: '음식점',
  url: 'https://place.map.kakao.com/k1',
  nearby: 'meal',
  ...over,
});

const trip = () => createTrip({ title: '강릉', startDate: '2026-05-01', endDate: '2026-05-02' });

describe('큰 지도에서 담기', () => {
  it('고른 날 일정 끝에 확인된 위치로 담고, 분류로 종류를 정한다', () => {
    const next = addNearbyStop(trip(), place(), '2026-05-02');
    const stop = next.stops.at(-1)!;
    expect(stop).toMatchObject({
      kind: 'meal',
      name: '테스트 순두부',
      date: '2026-05-02',
      address: '강원 강릉시 초당순두부길 77',
      location: { lat: 37.7905, lng: 128.9135 },
      placeRef: { provider: 'kakao', id: 'k1', url: 'https://place.map.kakao.com/k1' },
      locationStatus: 'verified',
      // 일정 맨 아래 후보로 들어간다(2026-10-01 사용자 결정).
      excluded: true,
    });
    expect(addNearbyStop(trip(), place({ nearby: 'cafe' }), null).stops.at(-1)!.kind).toBe('break');
    expect(addNearbyStop(trip(), place({ nearby: 'sight' }), null).stops.at(-1)!.kind).toBe('place');
  });

  it('같은 출처 번호거나 같은 이름이 가까우면 이미 담은 곳으로 본다', () => {
    const added = addNearbyStop(trip(), place(), '2026-05-01');
    expect(isInTrip(added, place())).toBe(true);
    const manual = { ...trip(), stops: [{ ...createStop({ name: '테스트 순두부' }), location: { lat: 37.79051, lng: 128.91351 } }] };
    expect(isInTrip(manual, place({ id: 'other' }))).toBe(true);
    expect(isInTrip(manual, place({ id: 'other', lat: 37.8 }))).toBe(false);
    expect(toPins(added, [place(), place({ id: 'k2', name: '다른 집', lat: 37.7, lng: 128.9 })]).map((p) => p.added)).toEqual(['candidate', false]);
    // 일정에 되돌리면(제외 해제) 회색 눈 대신 담음(체크)이다.
    const active = { ...added, stops: added.stops.map((st) => ({ ...st, excluded: false })) };
    expect(toPins(active, [place()])[0]!.added).toBe('scheduled');
  });
});
