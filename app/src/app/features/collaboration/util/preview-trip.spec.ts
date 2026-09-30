import { describe, expect, it } from 'vitest';
import { tripFromPreview } from './preview-trip';
import { itinerarySections, itineraryTicket } from '../../trips/util/itinerary-image';

const preview = {
  title: '강릉',
  startDate: '2026-10-10',
  endDate: '2026-10-11',
  ownerNickname: '주인',
  regions: [{ id: 'r1', name: '강릉시', order: 0 }],
  stops: [
    { name: '경포대', kind: 'place', date: '2026-10-10', order: 0, fixedTime: null, regionId: 'r1' },
    { name: '순두부', kind: 'meal', date: '2026-10-10', order: 1, fixedTime: '12:30', regionId: 'r1' },
  ],
  stays: [{ name: '호텔', checkIn: '2026-10-10', checkOut: '2026-10-11' }],
};

describe('tripFromPreview', () => {
  it('미리보기로 일정 카드를 그릴 수 있는 여행을 만든다', () => {
    const trip = tripFromPreview(preview);
    expect(trip.title).toBe('강릉');
    expect(trip.stops.map((s) => [s.name, s.kind, s.fixedTime, s.memo])).toEqual([
      ['경포대', 'place', null, ''],
      ['순두부', 'meal', '12:30', ''],
    ]);
    expect(trip.stays[0]).toMatchObject({ name: '호텔', checkIn: '2026-10-10', memo: '', reservation: 'unknown' });
    expect(itineraryTicket(trip).region).toContain('강릉');
    expect(itinerarySections(trip).length).toBeGreaterThan(0);
  });

  it('모르는 분류는 장소로 본다', () => {
    const trip = tripFromPreview({ ...preview, stops: [{ ...preview.stops[0], kind: 'unknown' }] });
    expect(trip.stops[0].kind).toBe('place');
  });
});

it('새 분류는 그대로, 모르는 분류는 관광으로 읽는다', () => {
  const trip = tripFromPreview({
    ...preview,
    stops: [
      { ...preview.stops[0]!, kind: 'activity' },
      { ...preview.stops[0]!, name: 'x', kind: 'unknown' },
      { ...preview.stops[0]!, name: 'y', kind: 'other' },
    ],
  });
  expect(trip.stops.map((s) => s.kind)).toEqual(['activity', 'place', 'other']);
});
