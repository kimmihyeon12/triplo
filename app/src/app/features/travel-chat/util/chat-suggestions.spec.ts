import { describe, expect, it } from 'vitest';
import { listChips, tripChips, pickRandomRegion } from './chat-suggestions';
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

  it('아무 데나 뽑기를 포함한다', () => {
    expect(listChips().some((c) => c.includes('아무 데나'))).toBe(true);
  });
});

describe('tripChips', () => {
  it('장소가 없으면 채우는 일을 먼저 권한다', () => {
    const chips = tripChips(trip());
    expect(chips[0]).toContain('채워');
  });

  it('미배치 장소가 있으면 배치를 권하는 칩을 넣는다', () => {
    const chips = tripChips(trip({ stops: [stop('a', null), stop('b', '2026-10-01')] }));
    expect(chips.some((c) => c.includes('남은 장소'))).toBe(true);
  });

  it('모두 배치되어 있으면 배치 칩을 넣지 않는다', () => {
    const chips = tripChips(trip({ stops: [stop('a', '2026-10-01')] }));
    expect(chips.some((c) => c.includes('남은 장소'))).toBe(false);
  });

  it('하루에 장소가 많으면 빡빡하다는 칩을 넣는다', () => {
    const stops = ['a', 'b', 'c', 'd', 'e'].map((id, i) => stop(id, '2026-10-01', i));
    expect(tripChips(trip({ stops })).some((c) => c.includes('빡빡'))).toBe(true);
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
