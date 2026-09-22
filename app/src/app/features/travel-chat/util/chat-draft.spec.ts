import { describe, expect, it } from 'vitest';
import { applyDraft, previewDraft } from './chat-draft';
import type { ChatDraft } from '../model/chat';
import type { Trip, TripStop } from '../../trips/model/trip';

function stop(id: string, name: string, date: string | null, order: number, lat = 0, lng = 0) {
  return {
    id,
    kind: 'place' as const,
    name,
    address: '',
    regionId: null,
    date,
    order,
    stayMinutes: null,
    memo: '',
    fixedTime: null,
    excluded: false,
    locationStatus: 'verified' as const,
    location: lat || lng ? { lat, lng } : null,
    placeRef: null,
  } satisfies TripStop;
}

function trip(stops: TripStop[] = []): Trip {
  return {
    id: 't1',
    title: '강릉 여행',
    startDate: '2026-10-01',
    endDate: '2026-10-03',
    regions: [{ id: 'r1', name: '강릉', order: 0 }],
    stops,
    stays: [],
    status: 'draft',
    createdAt: '2026-09-22T00:00:00.000Z',
    updatedAt: '2026-09-22T00:00:00.000Z',
    schemaVersion: 1,
  };
}

const day = '2026-10-01';

describe('previewDraft — 순서 변경', () => {
  const base = trip([
    stop('a', '철뚝소머리집', day, 0, 37.75, 128.9),
    stop('b', '복사꽃마을', day, 1, 37.8, 128.87),
    stop('c', '한과마을', day, 2, 37.79, 128.88),
  ]);
  const draft: ChatDraft = { action: 'move', date: day, orderedStopIds: ['b', 'c', 'a'] };

  it('바뀌기 전과 후를 나란히 보여준다', () => {
    const view = previewDraft(base, draft);
    expect(view.before.map((r) => r.name)).toEqual(['철뚝소머리집', '복사꽃마을', '한과마을']);
    expect(view.after.map((r) => r.name)).toEqual(['복사꽃마을', '한과마을', '철뚝소머리집']);
  });

  it('거리 차이는 저장된 좌표로 앱이 직접 계산한다', () => {
    const view = previewDraft(base, draft);
    expect(view.distanceDeltaKm).not.toBeNull();
    expect(Number.isFinite(view.distanceDeltaKm!)).toBe(true);
  });

  it('좌표가 없는 장소가 섞이면 거리 차이를 말하지 않는다', () => {
    const noCoords = trip([stop('a', '가', day, 0), stop('b', '나', day, 1)]);
    const view = previewDraft(noCoords, { action: 'move', date: day, orderedStopIds: ['b', 'a'] });
    expect(view.distanceDeltaKm).toBeNull();
  });

  it('내부 처리를 그대로 드러내지 않는 제목을 만든다', () => {
    const view = previewDraft(base, draft);
    expect(view.title).toContain('순서');
    expect(view.title).not.toContain('↔');
  });
});

describe('previewDraft — 추가', () => {
  it('더해질 장소만 뒤쪽에 보여준다', () => {
    const view = previewDraft(trip([stop('a', '오죽헌', day, 0)]), {
      action: 'append',
      regions: ['강릉'],
      places: [
        {
          id: 'p1',
          day: 1,
          name: '안목해변',
          kind: 'place',
          verified: true,
          note: '관광명소',
          address: '강릉시 창해로',
          location: { lat: 37.77, lng: 128.94 },
          placeRef: null,
        },
      ],
    });
    expect(view.after.map((r) => r.name)).toContain('안목해변');
    expect(view.after.find((r) => r.name === '안목해변')!.added).toBe(true);
  });

  it('확인되지 않은 장소는 담을 수 없으므로 뺀다', () => {
    const view = previewDraft(trip(), {
      action: 'append',
      regions: [],
      places: [
        {
          id: 'p1',
          day: 1,
          name: '없는장소',
          kind: 'place',
          verified: false,
          note: '직접 확인 필요',
          address: '',
          location: null,
          placeRef: null,
        },
      ],
    });
    expect(view.after).toHaveLength(0);
    expect(view.applicable).toBe(false);
  });
});

describe('previewDraft — 삭제', () => {
  it('빠질 장소를 표시한다', () => {
    const view = previewDraft(trip([stop('a', '가', day, 0), stop('b', '나', day, 1)]), {
      action: 'remove',
      stopIds: ['b'],
    });
    expect(view.before.map((r) => r.name)).toEqual(['가', '나']);
    expect(view.after.map((r) => r.name)).toEqual(['가']);
  });

  it('대상이 없으면 적용할 수 없다고 본다', () => {
    const view = previewDraft(trip([stop('a', '가', day, 0)]), {
      action: 'remove',
      stopIds: ['없음'],
    });
    expect(view.applicable).toBe(false);
  });
});

describe('previewDraft — 날짜 이동', () => {
  it('옮길 날짜를 제목에 적는다', () => {
    const view = previewDraft(trip([stop('a', '가', day, 0)]), {
      action: 'reschedule',
      stopId: 'a',
      date: '2026-10-02',
    });
    expect(view.applicable).toBe(true);
    expect(view.title).toContain('2일차');
  });
});

describe('applyDraft', () => {
  it('순서 변경을 실제 일정에 반영한다', () => {
    const base = trip([stop('a', '가', day, 0), stop('b', '나', day, 1), stop('c', '다', day, 2)]);
    const next = applyDraft(base, { action: 'move', date: day, orderedStopIds: ['c', 'a', 'b'] });
    const names = next.stops
      .filter((s) => s.date === day)
      .sort((x, y) => x.order - y.order)
      .map((s) => s.name);
    expect(names).toEqual(['다', '가', '나']);
  });

  it('삭제를 반영하고 남은 순서를 다시 매긴다', () => {
    const base = trip([stop('a', '가', day, 0), stop('b', '나', day, 1)]);
    const next = applyDraft(base, { action: 'remove', stopIds: ['a'] });
    expect(next.stops).toHaveLength(1);
    expect(next.stops[0]!.order).toBe(0);
  });

  it('날짜 이동을 반영한다', () => {
    const base = trip([stop('a', '가', day, 0)]);
    const next = applyDraft(base, { action: 'reschedule', stopId: 'a', date: '2026-10-02' });
    expect(next.stops[0]!.date).toBe('2026-10-02');
  });

  it('추가는 확인된 장소만 담고 좌표를 함께 저장한다', () => {
    const next = applyDraft(trip(), {
      action: 'append',
      regions: ['강릉'],
      places: [
        {
          id: 'p1',
          day: 1,
          name: '안목해변',
          kind: 'place',
          verified: true,
          note: '관광명소',
          address: '강릉시 창해로 17',
          location: { lat: 37.77, lng: 128.94 },
          placeRef: { provider: 'kakao', id: '1', url: null },
        },
        {
          id: 'p2',
          day: 1,
          name: '없는장소',
          kind: 'place',
          verified: false,
          note: '직접 확인 필요',
          address: '',
          location: null,
          placeRef: null,
        },
      ],
    });
    expect(next.stops).toHaveLength(1);
    expect(next.stops[0]!.name).toBe('안목해변');
    expect(next.stops[0]!.location).toEqual({ lat: 37.77, lng: 128.94 });
    expect(next.stops[0]!.locationStatus).toBe('verified');
    // 일차 1은 여행 시작일에 해당한다.
    expect(next.stops[0]!.date).toBe(day);
  });

  it('날짜가 없는 여행에 담으면 미배치로 둔다', () => {
    const undated = trip();
    undated.startDate = null;
    undated.endDate = null;
    const next = applyDraft(undated, {
      action: 'append',
      regions: [],
      places: [
        {
          id: 'p1',
          day: 1,
          name: '안목해변',
          kind: 'place',
          verified: true,
          note: '관광명소',
          address: '강릉시 창해로 17',
          location: { lat: 37.77, lng: 128.94 },
          placeRef: null,
        },
      ],
    });
    expect(next.stops[0]!.date).toBeNull();
  });
});
