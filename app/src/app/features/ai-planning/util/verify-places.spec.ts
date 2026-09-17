import { expect, it, describe, vi } from 'vitest';
import type { PlaceCandidate } from '../../places/model/place';
import type { PlaceSearchProvider } from '../../places/data/place-search';
import { verifyPlaces } from './verify-places';
import type { AiItem } from './ai-response';

function candidate(partial: Partial<PlaceCandidate> & { name: string }): PlaceCandidate {
  return {
    provider: 'kakao',
    id: partial.id ?? 'k1',
    name: partial.name,
    address: partial.address ?? '강원 강릉시 어딘가',
    roadAddress: partial.roadAddress ?? '',
    lat: partial.lat ?? 37.8,
    lng: partial.lng ?? 128.9,
    category: partial.category ?? '관광명소',
    url: partial.url ?? null,
  };
}

/** 이름별로 정해둔 결과를 돌려주는 가짜 검색. 외부 호출을 하지 않는다. */
function fakeSearch(byQuery: Record<string, PlaceCandidate[]>): PlaceSearchProvider {
  return {
    availability: async () => ({ available: true, reason: null, providerLabel: '가짜' }),
    search: async (query: string) => {
      const hit = Object.entries(byQuery).find(([key]) => query.includes(key));
      const candidates = hit?.[1] ?? [];
      return { candidates, total: candidates.length };
    },
  };
}

const items: AiItem[] = [
  { day: 1, name: '안목해변', kind: 'place' },
  { day: 1, name: '없는장소', kind: 'place' },
];

describe('verifyPlaces', () => {
  it('찾은 장소에는 좌표와 주소를 붙이고 확인됨으로 둔다', async () => {
    const search = fakeSearch({
      안목해변: [candidate({ name: '안목해변', lat: 37.77, lng: 128.95, category: '관광명소' })],
    });
    const [found] = await verifyPlaces(items, ['강릉'], search);
    expect(found!.verified).toBe(true);
    expect(found!.location).toEqual({ lat: 37.77, lng: 128.95 });
    expect(found!.address).toBe('강원 강릉시 어딘가');
    expect(found!.note).toBe('관광명소');
    expect(found!.placeRef).toEqual({ provider: 'kakao', id: 'k1', url: null });
  });

  it('찾지 못한 장소는 확인 필요로 두고 좌표를 만들지 않는다', async () => {
    const search = fakeSearch({ 안목해변: [candidate({ name: '안목해변' })] });
    const [, missing] = await verifyPlaces(items, ['강릉'], search);
    expect(missing!.verified).toBe(false);
    expect(missing!.location).toBeNull();
    expect(missing!.address).toBe('');
    expect(missing!.note).toBe('직접 확인 필요');
  });

  it('검색어에 지역을 앞에 붙인다', async () => {
    const search = fakeSearch({});
    const spy = vi.spyOn(search, 'search');
    await verifyPlaces([{ day: 1, name: '중앙시장', kind: 'place' }], ['통영'], search);
    expect(spy.mock.calls[0]![0]).toContain('통영');
    expect(spy.mock.calls[0]![0]).toContain('중앙시장');
  });

  it('검색이 실패해도 나머지 장소를 계속 확인한다', async () => {
    const search: PlaceSearchProvider = {
      availability: async () => ({ available: true, reason: null, providerLabel: '가짜' }),
      search: async (query: string) => {
        if (query.includes('안목해변')) throw new Error('검색 오류');
        return { candidates: [candidate({ name: '없는장소' })], total: 1 };
      },
    };
    const result = await verifyPlaces(items, ['강릉'], search);
    expect(result[0]!.verified).toBe(false);
    expect(result[1]!.verified).toBe(true);
  });

  it('일차와 이름은 그대로 남는다', async () => {
    const search = fakeSearch({});
    const [first] = await verifyPlaces(
      [{ day: 2, name: '초당순두부마을', kind: 'meal' }],
      ['강릉'],
      search,
    );
    expect(first!.day).toBe(2);
    expect(first!.name).toBe('초당순두부마을');
  });

  it('검색 분류가 음식점이면 식사로 고친다', async () => {
    const search = fakeSearch({
      아사달: [candidate({ name: '아사달', category: '음식점' })],
    });
    // 모델은 카페라 했지만 검색은 음식점이라고 한다. 검색을 믿는다.
    const [found] = await verifyPlaces([{ day: 1, name: '아사달', kind: 'break' }], [], search);
    expect(found!.kind).toBe('meal');
  });

  it('검색 분류가 카페면 카페로 고친다', async () => {
    const search = fakeSearch({
      교동다원: [candidate({ name: '교동다원', category: '카페' })],
    });
    const [found] = await verifyPlaces([{ day: 1, name: '교동다원', kind: 'meal' }], [], search);
    expect(found!.kind).toBe('break');
  });

  it('먹는 곳이 아니면 장소로 고친다', async () => {
    const search = fakeSearch({
      교동법주: [candidate({ name: '교동법주', category: '주류제조' })],
    });
    const [found] = await verifyPlaces([{ day: 1, name: '교동법주', kind: 'meal' }], [], search);
    expect(found!.kind).toBe('place');
  });

  it('분류를 알 수 없으면 모델이 정한 종류를 쓴다', async () => {
    const search = fakeSearch({
      어딘가: [candidate({ name: '어딘가', category: '' })],
    });
    const [found] = await verifyPlaces([{ day: 1, name: '어딘가', kind: 'meal' }], [], search);
    expect(found!.kind).toBe('meal');
  });

  it('항목마다 서로 다른 id를 준다', async () => {
    const search = fakeSearch({});
    const result = await verifyPlaces(items, ['강릉'], search);
    expect(new Set(result.map((r) => r.id)).size).toBe(result.length);
  });

  it('지역이 없으면 이름만으로 찾는다', async () => {
    const search = fakeSearch({});
    const spy = vi.spyOn(search, 'search');
    await verifyPlaces([{ day: 1, name: '오죽헌', kind: 'place' }], [], search);
    expect(spy.mock.calls[0]![0]).toBe('오죽헌');
  });

  it('빈 목록이면 아무것도 찾지 않는다', async () => {
    const search = fakeSearch({});
    const spy = vi.spyOn(search, 'search');
    expect(await verifyPlaces([], ['강릉'], search)).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('이름이 다른 후보는 받아들이지 않는다', async () => {
    // '롯데월드 안 식당'을 물었는데 검색이 서초의 동명 가게를 돌려주는 일이 있다.
    // 이름이 맞지 않으면 확정하지 않고 사용자가 직접 확인하게 남긴다.
    const search = fakeSearch({
      서울: [candidate({ name: '전혀 다른 가게', category: '음식점' })],
    });
    const [found] = await verifyPlaces([{ day: 1, name: '자이언트디거', kind: 'meal' }], ['서울'], search);
    expect(found!.verified).toBe(false);
    expect(found!.location).toBeNull();
  });

  it('이름이 맞는 후보가 뒤에 있어도 찾아낸다', async () => {
    // 검색은 가장 비슷한 것을 앞에 두지 우리가 물은 그것을 앞에 두지 않는다.
    const search = fakeSearch({
      서울: [
        candidate({ name: '중국성 서초점', id: 'k9', category: '음식점' }),
        candidate({ name: '롯데월드 어드벤처', id: 'k2', category: '관광명소' }),
      ],
    });
    const [found] = await verifyPlaces(
      [{ day: 1, name: '롯데월드 어드벤처', kind: 'place' }],
      ['서울'],
      search,
    );
    expect(found!.verified).toBe(true);
    expect(found!.placeRef?.id).toBe('k2');
  });

  it('띄어쓰기와 괄호가 달라도 같은 이름으로 본다', async () => {
    const search = fakeSearch({
      서울: [candidate({ name: '롯데월드(잠실점)', category: '관광명소' })],
    });
    const [found] = await verifyPlaces(
      [{ day: 1, name: '롯데월드 잠실점', kind: 'place' }],
      ['서울'],
      search,
    );
    expect(found!.verified).toBe(true);
  });

  it('카테고리가 없으면 확인됨이어도 설명을 비운다', async () => {
    const search = fakeSearch({
      안목해변: [candidate({ name: '안목해변', category: '' })],
    });
    const [found] = await verifyPlaces([items[0]!], ['강릉'], search);
    expect(found!.verified).toBe(true);
    expect(found!.note).toBe('');
  });
});
