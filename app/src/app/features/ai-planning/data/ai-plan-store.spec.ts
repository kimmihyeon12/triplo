import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { PLACE_SEARCH, type PlaceSearchProvider } from '../../places/data/place-search';
import type { PlaceCandidate } from '../../places/model/place';
import { AI_PLAN_PROVIDER, type AiPlanProvider } from './ai-plan-provider';
import { AiPlanStore } from './ai-plan-store';
import type { AiItem } from '../util/ai-response';

const ITEMS: readonly AiItem[] = [
  { day: 1, name: '안목해변', kind: 'place' },
  { day: 1, name: '초당순두부마을', kind: 'meal' },
  { day: 2, name: '없는곳', kind: 'place' },
];

function candidate(name: string): PlaceCandidate {
  return {
    provider: 'kakao',
    id: 'k-' + name,
    name,
    address: '강원 강릉시',
    roadAddress: '',
    lat: 37.8,
    lng: 128.9,
    category: '관광명소',
    url: null,
  };
}

/** '없는곳'만 검색에서 빠지는 가짜 제공자. 외부를 부르지 않는다. */
function fakeSearch(): PlaceSearchProvider {
  return {
    availability: async () => ({ available: true, reason: null, providerLabel: '가짜' }),
    search: async (query: string) => {
      if (query.includes('없는곳')) return { candidates: [], total: 0 };
      const name = query.split(' ').pop() ?? query;
      return { candidates: [candidate(name)], total: 1 };
    },
  };
}

function fakeAi(behavior: Partial<AiPlanProvider> = {}): AiPlanProvider {
  return {
    availability: async () => ({ available: true, reason: null }),
    generate: async () => ITEMS,
    ...behavior,
  };
}

function setup(ai: AiPlanProvider = fakeAi()): AiPlanStore {
  const injector = Injector.create({
    providers: [
      { provide: AI_PLAN_PROVIDER, useValue: ai },
      { provide: PLACE_SEARCH, useValue: fakeSearch() },
      AiPlanStore,
    ],
  });
  return runInInjectionContext(injector, () => injector.get(AiPlanStore));
}

/** 2박 3일 강릉 여행을 만들어 일차가 3개가 되게 한다. */
function threeDayTrip(ai?: AiPlanProvider): AiPlanStore {
  const store = setup(ai);
  store.set('regions', ['강릉']);
  store.set('startDate', '2026-10-01');
  store.set('endDate', '2026-10-03');
  return store;
}

describe('AiPlanStore 생성', () => {
  it('위치를 확인한 장소만 결과에 담는다', async () => {
    const store = threeDayTrip();
    await store.generate();
    expect(store.phase()).toBe('result');
    // 셋 중 '없는곳'은 검색에 없으므로 목록에 들어오지 않는다.
    expect(store.results()).toHaveLength(2);
    expect(store.results().some((i) => i.name === '없는곳')).toBe(false);
    const found = store.results().find((i) => i.name === '안목해변');
    expect(found?.location).toEqual({ lat: 37.8, lng: 128.9 });
  });

  it('남은 항목을 모두 기본 선택한다', async () => {
    const store = threeDayTrip();
    await store.generate();
    expect(store.selected().size).toBe(2);
  });

  it('담을 목록에는 선택한 항목만 들어간다', async () => {
    const store = threeDayTrip();
    await store.generate();
    const first = store.results()[0]!;
    store.toggle(first.id);
    expect(store.selection().items).toHaveLength(1);
  });

  it('전체 해제와 전체 선택을 한 번에 한다', async () => {
    const store = threeDayTrip();
    await store.generate();
    expect(store.allSelected()).toBe(true);

    store.toggleAll();
    expect(store.selected().size).toBe(0);
    expect(store.allSelected()).toBe(false);

    store.toggleAll();
    expect(store.selected().size).toBe(store.results().length);
    expect(store.allSelected()).toBe(true);
  });

  it('하나만 해제해도 전체 선택 상태가 풀린다', async () => {
    const store = threeDayTrip();
    await store.generate();
    store.toggle(store.results()[0]!.id);
    expect(store.allSelected()).toBe(false);
    // 이 상태에서 전체 토글을 누르면 모두 선택된다.
    store.toggleAll();
    expect(store.selected().size).toBe(store.results().length);
  });

  it('찾은 장소가 하나도 없으면 조건을 바꾸라고 알린다', async () => {
    const store = threeDayTrip(
      fakeAi({ generate: async () => [{ day: 1, name: '없는곳', kind: 'place' as const }] }),
    );
    await store.generate();
    expect(store.phase()).toBe('summary');
    expect(store.error()?.kind).toBe('empty');
  });

  it('연결에 실패하면 조건 화면으로 돌아가고 이유를 남긴다', async () => {
    const store = threeDayTrip(
      fakeAi({
        generate: async () => {
          throw new TypeError('Failed to fetch');
        },
      }),
    );
    store.set('phase', 'summary');
    await store.generate();
    expect(store.phase()).toBe('summary');
    expect(store.error()?.kind).toBe('offline');
    // 조건은 그대로 남는다.
    expect(store.regions()).toEqual(['강릉']);
  });

  it('하루 사용량을 다 쓰면 그 사정을 따로 알린다', async () => {
    const store = threeDayTrip(
      fakeAi({
        generate: async () => {
          throw new Error('오늘 사용량을 다 썼어요. 내일 다시 시도해 주세요.');
        },
      }),
    );
    await store.generate();
    expect(store.error()?.kind).toBe('quota');
    expect(store.error()?.message).toContain('오늘 사용량');
  });

  it('시간 초과는 따로 구분한다', async () => {
    const store = threeDayTrip(
      fakeAi({
        generate: async () => {
          throw new Error('응답이 너무 오래 걸립니다. 잠시 후 다시 시도해 주세요.');
        },
      }),
    );
    await store.generate();
    expect(store.error()?.kind).toBe('timeout');
  });

  it('빈 결과를 받으면 조건을 바꿔 보라고 알린다', async () => {
    const store = threeDayTrip(fakeAi({ generate: async () => [] }));
    await store.generate();
    expect(store.phase()).toBe('summary');
    expect(store.error()?.kind).toBe('empty');
    expect(store.results()).toEqual([]);
  });

  it('지역이나 날짜가 잘못되면 만들지 않는다', async () => {
    const store = setup();
    await store.generate();
    expect(store.phase()).toBe('step1');
  });

  it('성공하면 이전 오류를 지운다', async () => {
    const store = threeDayTrip();
    store.set('error', { kind: 'other', message: '이전 오류' });
    await store.generate();
    expect(store.error()).toBeNull();
  });

  it('조건 고치기로 돌아가면 오류를 지운다', async () => {
    const store = threeDayTrip();
    store.set('error', { kind: 'other', message: '이전 오류' });
    store.backToSummary();
    expect(store.phase()).toBe('summary');
    expect(store.error()).toBeNull();
  });
});

describe('AiPlanStore 일차 변경', () => {
  it('날짜를 정하면 그 기간의 일수만큼 일차를 고를 수 있다', () => {
    expect(threeDayTrip().dayChoices()).toEqual([1, 2, 3]);
  });

  it('날짜 미정이고 결과도 없으면 기본 일수를 쓴다', () => {
    expect(setup().dayChoices()).toEqual([1, 2]);
  });

  it('일차를 바꾸면 목록이 일차 순으로 다시 늘어선다', async () => {
    const store = threeDayTrip();
    await store.generate();
    const first = store.results()[0]!;
    store.setDay(first.id, 3);
    expect(store.items().find((i) => i.id === first.id)?.day).toBe(3);
    const days = store.items().map((i) => i.day);
    expect(days).toEqual([...days].sort((a, b) => a - b));
  });

  it('고를 수 있는 범위 밖의 일차는 무시한다', async () => {
    const store = threeDayTrip();
    await store.generate();
    const first = store.results()[0]!;
    store.setDay(first.id, 9);
    expect(store.items().find((i) => i.id === first.id)?.day).toBe(first.day);
  });

  it('없는 항목의 일차는 바꾸지 않는다', async () => {
    const store = threeDayTrip();
    await store.generate();
    store.setDay('없는id', 2);
    expect(store.dayOverrides()).toEqual({});
  });

  it('담을 목록에도 바꾼 일차가 반영된다', async () => {
    const store = threeDayTrip();
    await store.generate();
    const first = store.results().find((i) => i.verified)!;
    store.setDay(first.id, 3);
    expect(store.selection().items.find((i) => i.id === first.id)?.day).toBe(3);
  });

  it('일차가 길어도 고를 수 있는 목록을 낸다', () => {
    const long = setup();
    long.set('regions', ['강릉']);
    long.set('startDate', '2026-10-01');
    long.set('endDate', '2026-10-12');
    expect(long.dayChoices().length).toBe(12);
  });
});
