import { describe, expect, it } from 'vitest';
import type { PlaceCandidate } from '../../places/model/place';
import type { PlaceSearchProvider, PlaceSearchOptions } from '../../places/data/place-search';
import { areaOf, chatQueries, gatherCandidates, planQueries, themeKeywords } from './place-candidates';

function hit(id: string, name: string, category: string, address = '강원특별자치도 강릉시 초당동 123'): PlaceCandidate {
  return { provider: 'kakao', id, name, address, roadAddress: '', lat: 37.79, lng: 128.91, category, url: `https://place.map.kakao.com/${id}` };
}

function fakeSearch(byWord: Record<string, PlaceCandidate[]>, fail: string[] = []) {
  const calls: { query: string; options?: PlaceSearchOptions }[] = [];
  const provider: PlaceSearchProvider = {
    availability: async () => ({ available: true, reason: null, providerLabel: '가짜' }),
    search: async (query, options) => {
      calls.push({ query, options });
      if (fail.some((w) => query.includes(w))) throw new Error('offline');
      const found = Object.entries(byWord).find(([w]) => query.includes(w))?.[1] ?? [];
      return { candidates: found, total: found.length };
    },
  };
  return { provider, calls };
}

describe('동네 이름', () => {
  it('주소에서 시도를 빼고 시군구·동만 남긴다', () => {
    expect(areaOf('강원특별자치도 강릉시 초당동 123')).toBe('강릉시 초당동');
    expect(areaOf('부산 해운대구 우동 1408')).toBe('해운대구 우동');
    expect(areaOf('제주특별자치도 제주시 구좌읍 월정리 33-3')).toBe('제주시 구좌읍');
    expect(areaOf('')).toBe('');
  });
});

describe('테마 낱말', () => {
  it('정해진 표로 검색어를 고르고, 없으면 기본 셋을 쓴다', () => {
    expect(themeKeywords('강릉 카페 투어 하고 싶어')).toEqual(['카페']);
    expect(themeKeywords('전주 혼자 먹방')).toEqual(['맛집']);
    expect(themeKeywords('아이랑 갈 체험이랑 맛집')).toEqual(['맛집', '체험']);
    expect(themeKeywords('여수 밤바다 코스')).toEqual(['야경']);
    expect(themeKeywords('경주 코스 짜줘')).toEqual(['관광명소', '맛집', '카페']);
  });
});

describe('검색 계획', () => {
  it('일정 짜기는 지역마다 종류별로 찾고 당일치기면 숙소를 찾지 않는다', () => {
    const many = planQueries(['강릉'], { dayTrip: false, taste: '' });
    expect(many.map((q) => q.query)).toEqual(['강릉 관광명소', '강릉 가볼만한곳', '강릉 맛집', '강릉 카페', '강릉 체험', '강릉 시장', '강릉 호텔', '강릉 펜션']);
    expect(many.find((q) => q.query.endsWith('체험'))!.kind).toBe('activity');
    expect(many.find((q) => q.query.endsWith('시장'))!.kind).toBe('shopping');
    expect(planQueries(['강릉'], { dayTrip: true, taste: '' }).some((q) => /호텔|펜션/.test(q.query))).toBe(false);
  });
  it('일정 짜기 취향 낱말을 더하고 지역은 3곳까지만 찾는다', () => {
    const qs = planQueries(['강릉', '속초', '양양', '고성'], { dayTrip: true, taste: '야경' });
    expect(new Set(qs.map((q) => q.query.split(' ')[0]))).toEqual(new Set(['강릉', '속초', '양양']));
    expect(qs.some((q) => q.query === '강릉 야경')).toBe(true);
  });
  it('챗봇은 최대 4번, 지역이 없으면 찾지 않는다', () => {
    expect(chatQueries(['강릉'], '카페 투어', null).map((q) => q.query)).toEqual(['강릉 카페']);
    expect(chatQueries(['강릉', '속초'], '코스 짜줘', null)).toHaveLength(4);
    expect(chatQueries([], '카페', null)).toEqual([]);
  });
  it('챗봇은 기준 좌표가 있으면 근처 5km에서 찾는다', () => {
    const [q] = chatQueries(['강릉'], '카페', { lat: 1, lng: 2 });
    expect(q).toMatchObject({ near: { lat: 1, lng: 2 }, radius: 5000 });
  });
});

describe('후보 모으기', () => {
  it('번호를 매기고 분류·동네를 붙이며 겹치는 곳과 이미 있는 곳을 뺀다', async () => {
    const { provider } = fakeSearch({
      맛집: [hit('m1', '초당순두부마을', '음식점'), hit('m2', '물회집', '음식점')],
      카페: [hit('c1', '테라로사', '카페'), hit('m1', '초당순두부마을', '음식점')],
      체험: [hit('a1', '바다레일바이크', '여행')],
    });
    const pool = await gatherCandidates(provider, [
      { query: '강릉 맛집', size: 15, kind: 'meal' },
      { query: '강릉 카페', size: 15, kind: 'break' },
      { query: '강릉 체험', size: 10, kind: 'activity' },
    ], { exclude: ['물회집'], max: 40 });
    expect(pool.wire).toEqual([
      { id: 'c1', name: '초당순두부마을', kind: 'meal', category: '음식점', area: '강릉시 초당동' },
      { id: 'c2', name: '테라로사', kind: 'break', category: '카페', area: '강릉시 초당동' },
      { id: 'c3', name: '바다레일바이크', kind: 'activity', category: '여행', area: '강릉시 초당동' },
    ]);
    expect(pool.byId.get('c2')).toMatchObject({ name: '테라로사', lat: 37.79, kind: 'break' });
  });
  it('상한을 넘지 않고, 검색이 실패해도 나머지로 모은다', async () => {
    const many = Array.from({ length: 10 }, (_, i) => hit(`k${i}`, `장소${i}`, '관광명소'));
    const { provider } = fakeSearch({ 관광명소: many }, ['맛집']);
    const pool = await gatherCandidates(provider, [
      { query: '강릉 맛집', size: 15, kind: 'meal' },
      { query: '강릉 관광명소', size: 15, kind: 'place' },
    ], { exclude: [], max: 4 });
    expect(pool.wire.map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4']);
  });
  it('모두 실패하면 빈 후보다', async () => {
    const { provider } = fakeSearch({}, ['강릉']);
    const pool = await gatherCandidates(provider, [{ query: '강릉 맛집', size: 15, kind: 'meal' }], { exclude: [], max: 40 });
    expect(pool.wire).toEqual([]);
  });
});
