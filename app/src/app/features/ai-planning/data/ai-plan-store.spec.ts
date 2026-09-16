import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { SAMPLE_ITEMS } from '../model/ai-plan';
import { AiPlanStore } from './ai-plan-store';

function setup(): AiPlanStore {
  const injector = Injector.create({ providers: [AiPlanStore] });
  return runInInjectionContext(injector, () => injector.get(AiPlanStore));
}

/** 2박 3일 강릉 여행을 만들어 일차가 3개가 되게 한다. */
function threeDayTrip(): AiPlanStore {
  const store = setup();
  store.set('regions', ['강릉']);
  store.set('startDate', '2026-10-01');
  store.set('endDate', '2026-10-03');
  return store;
}

describe('AiPlanStore 일차 변경', () => {
  it('날짜를 정하면 그 기간의 일수만큼 일차를 고를 수 있다', () => {
    expect(threeDayTrip().dayChoices()).toEqual([1, 2, 3]);
  });

  it('날짜 미정이면 추천에 나온 마지막 일차까지만 고를 수 있다', () => {
    const recommended = Math.max(...SAMPLE_ITEMS.map((i) => i.day));
    expect(setup().dayChoices()).toEqual(
      Array.from({ length: recommended }, (_, i) => i + 1),
    );
  });

  it('일차를 바꾸면 목록이 일차 순으로 다시 늘어선다', () => {
    const store = threeDayTrip();
    store.setDay('s1', 3);
    const moved = store.items().find((i) => i.id === 's1');
    expect(moved?.day).toBe(3);
    // 3일차로 옮겼으니 2일차 항목들보다 뒤에 있어야 한다.
    const days = store.items().map((i) => i.day);
    expect(days).toEqual([...days].sort((a, b) => a - b));
  });

  it('고를 수 있는 범위 밖의 일차는 무시한다', () => {
    const store = threeDayTrip();
    store.setDay('s1', 9);
    expect(store.items().find((i) => i.id === 's1')?.day).toBe(1);
  });

  it('없는 항목의 일차는 바꾸지 않는다', () => {
    const store = threeDayTrip();
    store.setDay('없는id', 2);
    expect(store.dayOverrides()).toEqual({});
  });

  it('담을 목록에도 바꾼 일차가 반영된다', () => {
    const store = threeDayTrip();
    store.setDay('s1', 3);
    expect(store.selection().items.find((i) => i.id === 's1')?.day).toBe(3);
  });

  it('일차가 5개 이하면 칩으로, 그보다 많으면 드롭다운으로 고른다', () => {
    expect(threeDayTrip().useDayChips()).toBe(true);
    const long = setup();
    long.set('regions', ['강릉']);
    long.set('startDate', '2026-10-01');
    long.set('endDate', '2026-10-07');
    expect(long.dayChoices().length).toBe(7);
    expect(long.useDayChips()).toBe(false);
  });
});
