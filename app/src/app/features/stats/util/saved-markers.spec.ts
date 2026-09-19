import { describe, expect, it } from 'vitest';
import { createTrip, createStop, createStay } from '../../trips/util/factories';
import { savedMarkers } from './saved-markers';

const location = { lat: 37.566, lng: 126.978 };
describe('saved map markers', () => {
  it('uses only verified saved positions, including future plans, without mutating trips', () => {
    const trip = createTrip({ endDate: '2035-01-01', stops: [
      createStop({ name: '저장된 장소', location }), createStop({ name: '좌표 없음' }),
      { ...createStop({ name: '확인 안 됨', location }), locationStatus: 'unverified' },
      createStop({ name: '제외', location, excluded: true }),
      createStop({ kind: 'buffer', location }),
      createStop({ location: { lat: NaN, lng: 0 } }), createStop({ location: { lat: 100, lng: 200 } }),
    ] });
    const before = structuredClone(trip);
    const markers = savedMarkers([trip], 'all');
    expect(markers).toHaveLength(1);
    expect(markers[0].name).toBe('저장된 장소');
    expect(markers[0].location).toEqual(location);
    expect(trip).toEqual(before);
  });
  it('groups exact shared coordinates and filters by saved kind', () => {
    const trip = createTrip({ stops: [createStop({ name:'식사', kind:'meal', location }), createStop({ name:'카페', kind:'break', location })], stays:[createStay({name:'숙소',location,checkIn:'2030-01-01',checkOut:'2030-01-02'})] });
    expect(savedMarkers([trip], 'all')).toHaveLength(1);
    expect(savedMarkers([trip], 'all')[0].places).toHaveLength(3);
    expect(savedMarkers([trip], 'meal')[0].name).toBe('식사');
    expect(savedMarkers([trip], 'travel')[0].name).toBe('숙소');
    expect(savedMarkers([], 'all')).toEqual([]);
  });
});
