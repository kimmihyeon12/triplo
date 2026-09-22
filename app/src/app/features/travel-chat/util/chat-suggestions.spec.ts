import { describe, expect, it } from 'vitest';
import { listChips, tripChips, pickRandomRegion, refreshChips, regionChips } from './chat-suggestions';
import { answerLocally } from './local-answer';

describe('playful follow-up chips', () => {
  it('replaces saved legacy examples without changing functional choices', () => {
    expect(refreshChips(['강릉으로 일정 짜줘', '종로 일정 짜줘', '미배치 장소 모두 2026-10-01로 배정해', '안목해변 빼줘'])).toEqual([
      '강릉에서 먹방 코스 추천해줘', '종로에서 먹방 코스 추천해줘',
      '미배치 장소 모두 2026-10-01로 배정해', '안목해변 빼줘',
    ]);
  });

  it('offers a reroll and themed questions for the selected destination', () => {
    const result = answerLocally('여행지 랜덤으로 뽑아줘', null, [])!;
    expect(result.chips).toEqual(regionChips(result.regions[0]));
    expect(result.chips[0]).toBe('다시 뽑아줘');
    expect(result.chips.some((chip) => chip.includes('일정 짜줘'))).toBe(false);
    for (const chip of result.chips.slice(1)) expect(answerLocally(chip, null, [])).toBeNull();
  });
});
import type { Trip } from '../../trips/model/trip';

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 't1',
    title: '강릉 여행',
    startDate: '2026-10-01',
    endDate: '2026-10-03',
    regions: [{ id: 'r1', name: '강릉', order: 0 }],
    stops: [],
    stays: [],
    status: 'draft',
    createdAt: '2026-09-22T00:00:00.000Z',
    updatedAt: '2026-09-22T00:00:00.000Z',
    schemaVersion: 1,
    ...overrides,
  };
}

function stop(id: string, date: string | null, order = 0) {
  return {
    id,
    kind: 'place' as const,
    name: id,
    address: '',
    regionId: null,
    date,
    order,
    stayMinutes: null,
    memo: '',
    fixedTime: null,
    excluded: false,
    locationStatus: 'unverified' as const,
    location: null,
    placeRef: null,
  };
}

describe('listChips', () => {
  it('여행 목록에서는 네 개에서 여섯 개 사이의 칩을 준다', () => {
    const chips = listChips();
    expect(chips.length).toBeGreaterThanOrEqual(4);
    expect(chips.length).toBeLessThanOrEqual(6);
  });

  it('랜덤 여행지 뽑기를 맨 앞에 둔다', () => {
    expect(listChips()[0]).toContain('랜덤');
  });
});

describe('tripChips', () => {
  it('장소가 없어도 랜덤 여행지 뽑기를 먼저 권한다', () => {
    const chips = tripChips(trip());
    expect(chips[0]).toContain('랜덤');
  });

  it('미배치 장소가 있어도 기본 칩은 재미있는 탐색 질문을 쓴다', () => {
    const chips = tripChips(trip({ stops: [stop('a', null), stop('b', '2026-10-01')] }));
    expect(chips.some((c) => c.includes('먹방'))).toBe(true);
    expect(chips.some((c) => /배정|정리|삭제/.test(c))).toBe(false);
  });

  it('모두 배치되어 있으면 배치 칩을 넣지 않는다', () => {
    const chips = tripChips(trip({ stops: [stop('a', '2026-10-01')] }));
    expect(chips.some((c) => c.includes('미배치 장소'))).toBe(false);
  });

  it('저장된 지역을 여행 테마 질문에 포함한다', () => {
    const stops = ['a', 'b', 'c', 'd', 'e'].map((id, i) => stop(id, '2026-10-01', i));
    expect(tripChips(trip({ stops })).some((c) => c.includes('강릉에서 느긋한 하루'))).toBe(true);
  });

  it('칩은 여섯 개를 넘지 않는다', () => {
    const stops = ['a', 'b', 'c', 'd', 'e'].map((id, i) => stop(id, '2026-10-01', i));
    stops.push(stop('f', null, 5));
    expect(tripChips(trip({ stops })).length).toBeLessThanOrEqual(6);
  });
});

describe('pickRandomRegion', () => {
  it('실재하는 지역 목록에서 고른다. 모델이 지어내지 않는다', () => {
    const picked = pickRandomRegion([], () => 0);
    expect(picked).not.toBeNull();
    expect(picked!.name.length).toBeGreaterThan(0);
    // 코드는 '11_종로구'처럼 시·도 번호와 이름을 밑줄로 잇는다.
    expect(picked!.code).toContain('_');
  });

  it('최근에 뽑은 지역은 제외한다', () => {
    const first = pickRandomRegion([], () => 0)!;
    const second = pickRandomRegion([first.code], () => 0)!;
    expect(second.code).not.toBe(first.code);
  });

  it('최근 목록이 전부를 덮으면 그 제한을 풀고 하나를 준다', () => {
    const all = pickRandomRegion([], () => 0)!;
    const every = Array.from({ length: 300 }, (_, i) => `x-${i}`);
    expect(pickRandomRegion([...every, all.code], () => 0)).not.toBeNull();
  });
});
