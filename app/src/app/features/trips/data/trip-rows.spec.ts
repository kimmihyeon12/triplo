import { describe, expect, it } from 'vitest';
import { tripFromRow, type TripRow } from './trip-rows';

const row: TripRow = {
  id: 't1',
  title: '강릉',
  start_date: '2026-10-10',
  end_date: '2026-10-11',
  status: 'draft',
  schema_version: 1,
  created_at: '2026-09-29T00:00:00+00:00',
  updated_at: '2026-09-29T01:00:00+00:00',
  version: 3,
  trip_regions: [
    { id: 'r2', name: '속초시', order: 1, region_code: null },
    { id: 'r1', name: '강릉시', order: 0, region_code: '51150' },
  ],
  trip_stops: [
    {
      id: 's1',
      region_id: 'r1',
      kind: 'meal',
      name: '초당순두부',
      address: '강릉',
      date: '2026-10-10',
      order: 0,
      stay_minutes: 60,
      memo: '',
      fixed_time: '12:30',
      excluded: false,
      location_status: 'verified',
      lat: 37.7,
      lng: 128.9,
      place_provider: 'kakao',
      place_id: '99',
      place_url: 'https://place.map.kakao.com/99',
      estimated_cost: 12000,
    },
  ],
  accommodation_stays: [
    {
      id: 'a1',
      region_id: null,
      name: '바다숙소',
      address: '',
      check_in: '2026-10-10',
      check_out: '2026-10-11',
      check_in_time: null,
      check_out_time: null,
      day_order: null,
      reservation: 'unknown',
      memo: '',
      location_status: 'unverified',
      lat: null,
      lng: null,
      place_provider: null,
      place_id: null,
      place_url: null,
      estimated_cost: null,
    },
  ],
};

describe('tripFromRow', () => {
  it('snake_case 행을 앱 모델로 바꾸고 지역은 order로 정렬한다', () => {
    const trip = tripFromRow(row);
    expect(trip.startDate).toBe('2026-10-10');
    expect(trip.regions.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(trip.regions[0].regionCode).toBe('51150');
    expect(trip.regions[1]).not.toHaveProperty('regionCode');
    expect(trip.stops[0]).toMatchObject({
      regionId: 'r1',
      kind: 'meal',
      stayMinutes: 60,
      fixedTime: '12:30',
      locationStatus: 'verified',
      location: { lat: 37.7, lng: 128.9 },
      placeRef: { provider: 'kakao', id: '99', url: 'https://place.map.kakao.com/99' },
      estimatedCost: 12000,
    });
    expect(trip.stays[0]).toMatchObject({
      checkIn: '2026-10-10',
      location: null,
      placeRef: null,
      dayOrder: null,
    });
    expect(trip.schemaVersion).toBe(1);
  });

  it('좌표 한쪽만 있거나 제공자 id가 없으면 없는 것으로 본다', () => {
    const trip = tripFromRow({
      ...row,
      trip_stops: [{ ...row.trip_stops[0], lng: null, place_id: null }],
    });
    expect(trip.stops[0].location).toBeNull();
    expect(trip.stops[0].placeRef).toBeNull();
  });
});
