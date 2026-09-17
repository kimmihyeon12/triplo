import { expect, it, describe } from 'vitest';
import type { AiPlanSelection, PlanItem } from '../../ai-planning/model/ai-plan';
import { selectionToTrip } from './ai-selection';

function item(partial: Partial<PlanItem> & { id: string; name: string }): PlanItem {
  return {
    id: partial.id,
    day: partial.day ?? 1,
    name: partial.name,
    kind: partial.kind ?? 'place',
    verified: partial.verified ?? true,
    note: partial.note ?? '관광명소',
    address: partial.address ?? '강원 강릉시 어딘가',
    location: partial.location ?? { lat: 37.8, lng: 128.9 },
    placeRef: partial.placeRef ?? { provider: 'kakao', id: 'k1', url: null },
  };
}

function selection(partial: Partial<AiPlanSelection> = {}): AiPlanSelection {
  return {
    requestId: 'req-1',
    regions: ['강릉'],
    startDate: '2026-10-01',
    endDate: '2026-10-02',
    items: [],
    ...partial,
  };
}

describe('selectionToTrip', () => {
  it('확인된 장소의 좌표와 주소를 저장한다', () => {
    const trip = selectionToTrip(
      selection({
        items: [item({ id: 'a', name: '안목해변', location: { lat: 37.77, lng: 128.95 } })],
      }),
    );
    const stop = trip.stops[0]!;
    expect(stop.location).toEqual({ lat: 37.77, lng: 128.95 });
    expect(stop.address).toBe('강원 강릉시 어딘가');
    // 검색으로 확인한 좌표이므로 verified로 저장한다.
    expect(stop.locationStatus).toBe('verified');
    expect(stop.placeRef).toEqual({ provider: 'kakao', id: 'k1', url: null });
  });

  it('확인하지 못한 장소는 담지 않는다', () => {
    const trip = selectionToTrip(
      selection({
        items: [
          item({ id: 'a', name: '확인됨' }),
          item({ id: 'b', name: '미확인', verified: false, location: null, placeRef: null }),
        ],
      }),
    );
    expect(trip.stops.map((s) => s.name)).toEqual(['확인됨']);
  });

  it('일차를 실제 날짜로 바꾼다', () => {
    const trip = selectionToTrip(
      selection({
        startDate: '2026-10-01',
        endDate: '2026-10-03',
        items: [
          item({ id: 'a', name: '첫날', day: 1 }),
          item({ id: 'b', name: '셋째날', day: 3 }),
        ],
      }),
    );
    expect(trip.stops.find((s) => s.name === '첫날')?.date).toBe('2026-10-01');
    expect(trip.stops.find((s) => s.name === '셋째날')?.date).toBe('2026-10-03');
  });

  it('날짜 미정 여행은 장소를 미배치로 담는다', () => {
    const trip = selectionToTrip(
      selection({
        startDate: null,
        endDate: null,
        items: [item({ id: 'a', name: '미배치', day: 1 })],
      }),
    );
    expect(trip.stops[0]!.date).toBeNull();
  });

  it('식사와 카페 분류를 그대로 담는다', () => {
    const trip = selectionToTrip(
      selection({
        items: [
          item({ id: 'a', name: '순두부', kind: 'meal' }),
          item({ id: 'b', name: '커피', kind: 'break' }),
          item({ id: 'c', name: '해변', kind: 'place' }),
        ],
      }),
    );
    expect(trip.stops.map((s) => s.kind)).toEqual(['meal', 'break', 'place']);
  });

  it('AI가 쓴 설명을 메모로 남기지 않는다', () => {
    const trip = selectionToTrip(
      selection({ items: [item({ id: 'a', name: '안목해변', note: '관광명소' })] }),
    );
    // 메모는 사용자가 쓰는 자리다. 검색 분류를 메모로 옮기지 않는다.
    expect(trip.stops[0]!.memo).toBe('');
  });

  it('지역 이름으로 여행 제목을 만든다', () => {
    expect(selectionToTrip(selection({ regions: ['강릉', '속초'] })).title).toBe('강릉·속초 여행');
    expect(selectionToTrip(selection({ regions: [] })).title).toBe('새 여행');
  });

});
