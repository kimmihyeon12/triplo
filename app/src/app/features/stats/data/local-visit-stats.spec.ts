import '@angular/compiler';
import { Injector } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { createRegion, createStop, createTrip } from '../../trips/util/factories';
import { TRIP_REPOSITORY, type TripRepository } from '../../trips/data/trip-repository';
import { LocalVisitStats } from './local-visit-stats';
import { savedMarkers } from '../util/saved-markers';

function repoWith(trips = [
  createTrip({
    id: 't1', startDate: '2020-05-01', endDate: '2020-05-02', regions: [createRegion('강릉', 0, 'r1')],
    stops: [createStop({ name: '경포대', address: '강원 강릉시 저동 1', regionId: 'r1', location: { lat: 37.8, lng: 128.9 } })],
  }),
]) {
  let calls = 0;
  const repo = { list: async () => (calls++, trips) } as unknown as TripRepository;
  return { repo, calls: () => calls, trips };
}

describe('LocalVisitStats.mapSnapshot', () => {
  // 리팩터링 제안 R4: 지도 한 번 로딩에 집계·마커·지점이 각각 전체 여행을 읽었다.
  it('여행 목록을 한 번만 읽고 집계·마커·지점을 같은 스냅샷에서 계산한다', async () => {
    const { repo, calls, trips } = repoWith();
    const injector = Injector.create({ providers: [LocalVisitStats, { provide: TRIP_REPOSITORY, useValue: repo }] });
    const stats = injector.get(LocalVisitStats);
    const snapshot = await stats.mapSnapshot('all');
    expect(calls()).toBe(1);
    expect(snapshot.summary).toEqual(await stats.provinceCounts('all'));
    expect(snapshot.spots).toEqual(await stats.spots());
    expect(snapshot.markers).toEqual(savedMarkers(trips, 'all'));
  });
});
