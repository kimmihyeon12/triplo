import { describe, expect, it, vi } from 'vitest';
import { KOREA_REGIONS } from '../../../shared/util/korea-regions';
import { answerLocally } from './local-answer';
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

const day1 = '2026-10-01';

describe('answerLocally — 모델을 부르지 않아도 되는 질문', () => {
  it('여행과 무관한 질문은 정해진 안내로 가로챈다', () => {
    const answer = answerLocally('코드 짜줘', null, []);
    expect(answer).not.toBeNull();
    expect(answer!.kind).toBe('refusal');
    expect(answer!.chips.length).toBeGreaterThan(0);
  });

  it('앱이 다루지 않는 일은 일정으로 유도하며 가로챈다', () => {
    const answer = answerLocally('항공권 얼마야', null, []);
    expect(answer!.kind).toBe('outside');
    expect(answer!.text).toContain('일정');
  });

  it('랜덤 뽑기는 앱이 지역을 골라 답한다', () => {
    const answer = answerLocally('아무 데나 뽑아줘', null, []);
    expect(answer).not.toBeNull();
    expect(answer!.kind).toBe('explore');
    expect(answer!.regions).toHaveLength(1);
    expect(answer!.regions[0]!.length).toBeGreaterThan(0);
  });

  it('랜덤 뽑기는 최근에 뽑은 지역을 피한다', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const first = answerLocally('랜덤으로 골라줘', null, [])!;
      expect(first.regions[0]).toBe(KOREA_REGIONS[0].name);
      const again = answerLocally('랜덤으로 골라줘', null, [KOREA_REGIONS[0].code])!;
      expect(again.regions[0]).toBe(KOREA_REGIONS[1].name);
    } finally {
      random.mockRestore();
    }
  });

  it('탐색 질문은 가로채지 않고 모델에게 넘긴다', () => {
    expect(answerLocally('3일 쉬는데 어디 가지', null, [])).toBeNull();
  });

  it('영업정보 질문은 모델에게 넘긴다. 앱이 답할 근거가 없다', () => {
    expect(answerLocally('불국사 몇 시에 열어', null, [])).toBeNull();
  });
});

describe('answerLocally — 일정 편집 요청', () => {
  it('순서 정리는 저장된 좌표로 앱이 직접 계산한다', () => {
    const base = trip([
      stop('a', '철뚝소머리집', day1, 0, 37.75, 128.9),
      stop('b', '복사꽃마을', day1, 1, 37.8, 128.87),
      stop('c', '한과마을', day1, 2, 37.79, 128.88),
    ]);
    const answer = answerLocally('동선에 맞게 순서 정리해줘', base, []);
    expect(answer).not.toBeNull();
    expect(answer!.edit).not.toBeNull();
    expect(answer!.edit!.action).toBe('move');
  });

  it('이름을 대고 빼 달라고 하면 그 장소를 찾아 초안을 만든다', () => {
    const base = trip([stop('a', '오죽헌', day1, 0), stop('b', '안목해변', day1, 1)]);
    const answer = answerLocally('안목해변 빼줘', base, []);
    expect(answer!.edit).toEqual({ action: 'remove', names: ['안목해변'] });
  });

  it('없는 이름을 빼 달라고 하면 되묻고 일을 벌이지 않는다', () => {
    const base = trip([stop('a', '오죽헌', day1, 0)]);
    const answer = answerLocally('경포대 빼줘', base, []);
    expect(answer!.edit).toBeNull();
    expect(answer!.text).toContain('찾지 못');
  });

  it('장소가 없는 여행에서 순서 정리를 요청하면 할 일이 없다고 알린다', () => {
    const answer = answerLocally('순서 정리해줘', trip(), []);
    expect(answer!.edit).toBeNull();
    expect(answer!.text).toContain('없');
  });

  it('여행 없이 순서 정리를 요청하면 가로채지 않는다', () => {
    expect(answerLocally('순서 정리해줘', null, [])).toBeNull();
  });

  it('좌표가 없어 정렬할 수 없으면 그 사실을 알린다', () => {
    const base = trip([stop('a', '가', day1, 0), stop('b', '나', day1, 1)]);
    const answer = answerLocally('순서 정리해줘', base, []);
    expect(answer!.edit).toBeNull();
    expect(answer!.text).toContain('위치');
  });
});
