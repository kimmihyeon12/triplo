import { describe, expect, it, vi } from 'vitest';
import type { PlaceCandidate } from '../../places/model/place';
import type { PlaceSearchProvider } from '../../places/data/place-search';
import type { VerifiedItem } from '../model/ai-plan';
import { DAY_MINIMUM, fillDayMinimums } from './fill-day-minimums';

function candidate(id: string, name: string, category: string): PlaceCandidate {
  return { provider: 'kakao', id, name, address: '강원 강릉시', roadAddress: '', lat: 37.8, lng: 128.9, category, url: null };
}

/** 검색어에 든 낱말로 결과를 고른다. 호출을 기록한다. */
function fakeSearch(byWord: Record<string, PlaceCandidate[]>) {
  const calls: { query: string; near: unknown; radius?: number }[] = [];
  const provider: PlaceSearchProvider = {
    availability: async () => ({ available: true, reason: null, providerLabel: '가짜' }),
    search: async (query, options) => {
      calls.push({ query, near: options?.near ?? null, radius: options?.radius });
      const hit = Object.entries(byWord).find(([word]) => query.includes(word));
      const candidates = hit?.[1] ?? [];
      return { candidates, total: candidates.length };
    },
  };
  return { provider, calls };
}

let seq = 0;
function item(day: number, kind: VerifiedItem['kind'], start: string | null, name?: string): VerifiedItem {
  seq++;
  name ??= `장소${seq}`;
  return {
    id: `ai-${seq}`, day, name, kind, order: seq, start, moveToNext: { minutes: 10, mode: 'walk' } as never,
    verified: true, note: '', address: '주소', location: { lat: 37.7, lng: 128.8 },
    placeRef: { provider: 'kakao', id: `p-${name}`, url: null },
  };
}

const FOOD = [candidate('m1', '초당순두부', '음식점 > 한식'), candidate('m2', '물회집', '음식점 > 해물'), candidate('m3', '국밥집', '음식점 > 한식')];
const CAFE = [candidate('c1', '바다카페', '음식점 > 카페')];
const SIGHT = [candidate('s1', '경포대', '여행 > 관광,명소'), candidate('s2', '오죽헌', '여행 > 관광,명소'), candidate('s3', '선교장', '여행 > 관광,명소')];

describe('하루 최소 구성 채우기', () => {
  it('속도별 최소 구성: 관광(쇼핑·액티비티 포함)·카페·식사', () => {
    expect(DAY_MINIMUM['여유롭게']).toEqual({ sights: 1, cafe: 1, meals: 2 });
    expect(DAY_MINIMUM['보통']).toEqual({ sights: 2, cafe: 1, meals: 2 });
    expect(DAY_MINIMUM['알차게']).toEqual({ sights: 3, cafe: 1, meals: 2 });
  });

  it('식당이 모두 빠진 날에 점심·저녁을 근처 실제 식당으로 채운다', async () => {
    const { provider, calls } = fakeSearch({ 맛집: FOOD });
    const day = [item(1, 'place', '10:00'), item(1, 'break', '15:00'), item(1, 'place', '16:00')];
    const { items, missing } = await fillDayMinimums(day, 1, '보통', ['강릉'], provider);
    const meals = items.filter((i) => i.kind === 'meal');
    expect(meals.map((m) => m.start)).toEqual(['12:00', '18:00']);
    expect(meals.every((m) => m.verified && m.location && m.placeRef)).toBe(true);
    expect(meals.map((m) => m.name)).toEqual(['초당순두부', '물회집']);
    expect(calls[0]!.near).toEqual({ lat: 37.7, lng: 128.8 });
    expect(calls[0]!.radius).toBe(5000);
    expect(missing).toEqual([]);
  });

  it('점심만 있으면 저녁만 채우고, 시간 순서대로 끼운다', async () => {
    const { provider } = fakeSearch({ 맛집: FOOD });
    const day = [item(1, 'place', '10:00'), item(1, 'meal', '12:30'), item(1, 'break', '15:00'), item(1, 'place', '16:00')];
    const { items } = await fillDayMinimums(day, 1, '보통', ['강릉'], provider);
    const one = items.filter((i) => i.day === 1).sort((a, b) => a.order - b.order);
    expect(one.map((i) => i.start)).toEqual(['10:00', '12:30', '15:00', '16:00', '18:00']);
    // 끼운 자리 앞 항목의 이동 정보는 더 맞지 않아 지운다.
    expect(one[3]!.moveToNext).toBeNull();
  });

  it('쇼핑·액티비티도 관광으로 센다', async () => {
    const { provider, calls } = fakeSearch({ 맛집: FOOD, 카페: CAFE, 관광명소: SIGHT });
    const day = [item(1, 'shopping', '10:00'), item(1, 'meal', '12:00'), item(1, 'activity', '14:00'), item(1, 'break', '15:30'), item(1, 'meal', '18:00')];
    const { items } = await fillDayMinimums(day, 1, '보통', ['강릉'], provider);
    expect(items).toHaveLength(5);
    expect(calls).toEqual([]);
  });

  it('여유롭게는 관광 1곳, 알차게는 3곳을 맞춘다', async () => {
    const base = () => [item(1, 'meal', '12:00'), item(1, 'break', '15:00'), item(1, 'meal', '18:00')];
    const relaxed = await fillDayMinimums(base(), 1, '여유롭게', ['강릉'], fakeSearch({ 관광명소: SIGHT }).provider);
    expect(relaxed.items.filter((i) => i.kind === 'place')).toHaveLength(1);
    const packed = await fillDayMinimums(base(), 1, '알차게', ['강릉'], fakeSearch({ 관광명소: SIGHT }).provider);
    expect(packed.items.filter((i) => i.kind === 'place')).toHaveLength(3);
  });

  it('아무것도 남지 않은 날도 지역 이름으로 찾아 채운다', async () => {
    const { provider, calls } = fakeSearch({ 맛집: FOOD, 카페: CAFE, 관광명소: SIGHT });
    const { items } = await fillDayMinimums([item(1, 'place', '10:00'), item(1, 'place', '14:00'), item(1, 'meal', '12:00'), item(1, 'meal', '18:00'), item(1, 'break', '15:00')], 2, '보통', ['강릉'], provider);
    const two = items.filter((i) => i.day === 2);
    expect(two.filter((i) => i.kind === 'meal')).toHaveLength(2);
    expect(two.filter((i) => i.kind === 'break')).toHaveLength(1);
    expect(two.filter((i) => i.kind === 'place')).toHaveLength(2);
    expect(calls.some((c) => c.query.startsWith('강릉'))).toBe(true);
  });

  it('이미 일정에 있는 곳은 다시 넣지 않고, 업종이 다른 결과는 쓰지 않는다', async () => {
    const { provider } = fakeSearch({ 맛집: [candidate('p-먼저간곳', '먼저간곳', '음식점 > 한식'), candidate('x', '주유소', '교통 > 주유소'), candidate('m9', '새식당', '음식점 > 한식')] });
    const day = [item(1, 'place', '10:00'), item(1, 'meal', '12:00', '먼저간곳'), item(1, 'break', '15:00'), item(1, 'place', '16:00')];
    const { items } = await fillDayMinimums(day, 1, '보통', ['강릉'], provider);
    expect(items.filter((i) => i.kind === 'meal').map((i) => i.name)).toEqual(['먼저간곳', '새식당']);
  });

  it('찾지 못하면 지어내지 않고 빠진 자리를 알린다', async () => {
    const { provider } = fakeSearch({});
    const day = [item(1, 'place', '10:00'), item(1, 'break', '15:00'), item(1, 'place', '16:00')];
    const { items, missing } = await fillDayMinimums(day, 1, '보통', ['강릉'], provider);
    expect(items).toHaveLength(3);
    expect(missing).toEqual([{ day: 1, slot: '점심' }, { day: 1, slot: '저녁' }]);
  });

  it('검색이 실패해도 나머지 일정은 그대로 둔다', async () => {
    const provider: PlaceSearchProvider = {
      availability: async () => ({ available: true, reason: null, providerLabel: '가짜' }),
      search: vi.fn(async () => { throw new Error('offline'); }),
    };
    const day = [item(1, 'place', '10:00'), item(1, 'place', '16:00')];
    const { items, missing } = await fillDayMinimums(day, 1, '보통', ['강릉'], provider);
    expect(items).toHaveLength(2);
    expect(missing.map((m) => m.slot)).toEqual(['점심', '카페', '저녁']);
  });

  describe('사용자가 고른 식당은 식사 한 자리를 대신한다', () => {
    it('추가 요청에 이름을 쓴 식당이 점심이면 AI 점심을 뺀다', async () => {
      const { provider } = fakeSearch({});
      const day = [item(1, 'place', '10:00'), item(1, 'meal', '12:00', 'AI점심'), item(1, 'meal', '12:30', '초당순두부마을'), item(1, 'break', '15:00'), item(1, 'place', '16:00'), item(1, 'meal', '18:00', 'AI저녁')];
      const { items } = await fillDayMinimums(day, 1, '보통', ['강릉'], provider, '점심은 초당순두부마을에서 먹고 싶어');
      expect(items.filter((i) => i.kind === 'meal').map((i) => i.name)).toEqual(['초당순두부마을', 'AI저녁']);
    });

    it('꼭 갈 식당은 시각이 없으면 비어 있는 식사 자리에 들어간다', async () => {
      const { provider, calls } = fakeSearch({ 맛집: FOOD });
      const must: VerifiedItem = { ...item(1, 'meal', null, '신가회전훠궈'), id: 'must-0' };
      const day = [item(1, 'place', '10:00'), item(1, 'meal', '12:00', 'AI점심'), item(1, 'break', '15:00'), item(1, 'place', '16:00'), must];
      const { items } = await fillDayMinimums(day, 1, '보통', ['강릉'], provider, '신가회전훠궈');
      const one = items.filter((i) => i.day === 1).sort((a, b) => a.order - b.order);
      expect(one.filter((i) => i.kind === 'meal').map((i) => [i.name, i.start])).toEqual([['AI점심', '12:00'], ['신가회전훠궈', '18:00']]);
      expect(one.map((i) => i.start)).toEqual(['10:00', '12:00', '15:00', '16:00', '18:00']);
      // 저녁 자리를 차지했으니 더 찾지 않는다.
      expect(calls.filter((c) => c.query.includes('맛집'))).toEqual([]);
    });

    it('식사 자리가 다 찼으면 꼭 갈 식당이 점심을 대신한다', async () => {
      const { provider } = fakeSearch({});
      const must: VerifiedItem = { ...item(1, 'meal', null, '신가회전훠궈'), id: 'must-0' };
      const day = [item(1, 'place', '10:00'), item(1, 'meal', '12:00', 'AI점심'), item(1, 'break', '15:00'), item(1, 'place', '16:00'), item(1, 'meal', '18:00', 'AI저녁'), must];
      const { items } = await fillDayMinimums(day, 1, '보통', ['강릉'], provider, '신가회전훠궈');
      expect(items.filter((i) => i.kind === 'meal').map((i) => [i.name, i.start])).toEqual([['신가회전훠궈', '12:00'], ['AI저녁', '18:00']]);
    });

    it('식당이 아닌 꼭 갈 곳은 식사 자리를 건드리지 않는다', async () => {
      const { provider } = fakeSearch({});
      const must: VerifiedItem = { ...item(1, 'place', null, '경포대'), id: 'must-0' };
      const day = [item(1, 'meal', '12:00', 'AI점심'), item(1, 'break', '15:00'), item(1, 'meal', '18:00', 'AI저녁'), item(1, 'place', '10:00'), must];
      const { items } = await fillDayMinimums(day, 1, '보통', ['강릉'], provider, '경포대');
      expect(items.filter((i) => i.kind === 'meal').map((i) => i.name)).toEqual(['AI점심', 'AI저녁']);
    });
  });

  describe('아침', () => {
    it('추가 요청에 아침이 있으면 아침 자리도 채운다', async () => {
      const { provider } = fakeSearch({ 맛집: FOOD });
      const day = [item(1, 'place', '10:00'), item(1, 'meal', '12:00'), item(1, 'break', '15:00'), item(1, 'place', '16:00'), item(1, 'meal', '18:00')];
      const { items } = await fillDayMinimums(day, 1, '보통', ['강릉'], provider, '아침도 먹고 싶어요');
      const one = items.filter((i) => i.day === 1).sort((a, b) => a.order - b.order);
      expect(one[0]).toMatchObject({ kind: 'meal', start: '08:30' });
      expect(one.filter((i) => i.kind === 'meal')).toHaveLength(3);
    });

    it('요청이 없어도 AI가 넣은 아침은 남기고, 점심으로 세지 않는다', async () => {
      const { provider } = fakeSearch({ 맛집: FOOD });
      const day = [item(1, 'meal', '08:00', 'AI아침'), item(1, 'place', '10:00'), item(1, 'break', '15:00'), item(1, 'place', '16:00'), item(1, 'meal', '18:00', 'AI저녁')];
      const { items } = await fillDayMinimums(day, 1, '보통', ['강릉'], provider);
      expect(items.filter((i) => i.kind === 'meal').map((i) => i.start).sort()).toEqual(['08:00', '12:00', '18:00']);
    });

    it('아침 식당을 못 찾으면 아침 자리로 알린다', async () => {
      const day = [item(1, 'place', '10:00'), item(1, 'meal', '12:00'), item(1, 'break', '15:00'), item(1, 'place', '16:00'), item(1, 'meal', '18:00')];
      const { missing } = await fillDayMinimums(day, 1, '보통', ['강릉'], fakeSearch({}).provider, '조식 포함');
      expect(missing).toEqual([{ day: 1, slot: '아침' }]);
    });
  });

  describe('남은 후보 먼저', () => {
    it('근처 5km 안의 쓰지 않은 후보로 먼저 채우고 검색하지 않는다', async () => {
      const { provider, calls } = fakeSearch({ 맛집: FOOD });
      const spare = [
        { ...candidate('far', '먼식당', '음식점'), lat: 38.5, lng: 128.9, kind: 'meal' as const },
        { ...candidate('near', '가까운식당', '음식점'), lat: 37.701, lng: 128.801, kind: 'meal' as const },
      ];
      const day = [item(1, 'place', '10:00'), item(1, 'meal', '12:00'), item(1, 'break', '15:00'), item(1, 'place', '16:00')];
      const { items } = await fillDayMinimums(day, 1, '보통', ['강릉'], provider, '', spare);
      expect(items.find((i) => i.start === '18:00')?.name).toBe('가까운식당');
      expect(calls).toEqual([]);
    });
  });
});

