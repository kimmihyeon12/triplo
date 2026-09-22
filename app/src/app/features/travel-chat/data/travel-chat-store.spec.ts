import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { PLACE_SEARCH, type PlaceSearchProvider } from '../../places/data/place-search';
import type { PlaceCandidate } from '../../places/model/place';
import type { Trip, TripStop } from '../../trips/model/trip';
import { CHAT_TURN_LIMIT, type ChatReply } from '../model/chat';
import { CHAT_PROVIDER, type ChatProvider } from './chat-provider';
import { CHAT_HISTORY, LocalChatHistory, type KeyValueStorage } from './chat-history';
import { TravelChatStore } from './travel-chat-store';

function candidate(name: string): PlaceCandidate {
  return {
    provider: 'kakao',
    id: 'k-' + name,
    name,
    address: '강원 강릉시',
    roadAddress: '강원 강릉시 창해로 17',
    lat: 37.8,
    lng: 128.9,
    category: '관광명소',
    url: null,
  };
}

/** '없는장소'만 검색에서 빠지는 가짜 제공자. 외부를 부르지 않는다. */
function fakeSearch(): PlaceSearchProvider {
  return {
    availability: async () => ({ available: true, reason: null, providerLabel: '가짜' }),
    search: async (query: string) => {
      if (query.includes('없는장소')) return { candidates: [], total: 0 };
      const name = query.split(' ').pop() ?? query;
      return { candidates: [candidate(name)], total: 1 };
    },
  };
}

function reply(partial: Partial<ChatReply> = {}): ChatReply {
  return {
    kind: 'explore',
    text: '강릉은 어떠세요?',
    reference: null,
    chips: [],
    places: [],
    regions: [],
    edit: null,
    ...partial,
  };
}

function fakeChat(behavior: Partial<ChatProvider> = {}): ChatProvider & { calls: number } {
  const provider = {
    calls: 0,
    availability: async () => ({ available: true, reason: null }),
    reply: async () => {
      provider.calls += 1;
      return reply();
    },
    ...behavior,
  };
  // 넘겨받은 reply도 호출 수를 세도록 감싼다.
  if (behavior.reply) {
    const inner = behavior.reply;
    provider.reply = async (...args: Parameters<ChatProvider['reply']>) => {
      provider.calls += 1;
      return inner(...args);
    };
  }
  return provider as ChatProvider & { calls: number };
}

function memoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function setup(chat: ChatProvider = fakeChat()): TravelChatStore {
  const injector = Injector.create({
    providers: [
      { provide: CHAT_PROVIDER, useValue: chat },
      { provide: PLACE_SEARCH, useValue: fakeSearch() },
      { provide: CHAT_HISTORY, useValue: new LocalChatHistory(memoryStorage(), 'test.chat') },
      TravelChatStore,
    ],
  });
  return runInInjectionContext(injector, () => injector.get(TravelChatStore));
}

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

describe('TravelChatStore 시작', () => {
  it('처음에는 대화가 비어 있고 추천 칩을 보여준다', () => {
    const store = setup();
    expect(store.messages()).toHaveLength(0);
    expect(store.chips().length).toBeGreaterThan(0);
  });

  it('여행 목록에서 열면 목록용 칩을 쓴다', () => {
    const store = setup();
    store.open('list', null);
    expect(store.chips().some((c) => c.includes('아무 데나'))).toBe(true);
  });

  it('여행 상세에서 열면 그 여행의 상태를 반영한 칩을 쓴다', () => {
    const store = setup();
    store.open('trip', trip([stop('a', '오죽헌', null, 0)]));
    expect(store.chips().some((c) => c.includes('남은 장소'))).toBe(true);
  });
});

describe('TravelChatStore 보내기', () => {
  it('보낸 말과 답이 차례로 쌓인다', async () => {
    const store = setup();
    store.open('list', null);
    await store.send('어디 갈까');
    expect(store.messages().map((m) => m.role)).toEqual(['user', 'assistant']);
  });

  it('공백만 보내면 아무 일도 하지 않는다', async () => {
    const chat = fakeChat();
    const store = setup(chat);
    store.open('list', null);
    await store.send('   ');
    expect(store.messages()).toHaveLength(0);
    expect(chat.calls).toBe(0);
  });

  it('여행과 무관한 질문은 모델을 부르지 않고 정해진 안내를 준다', async () => {
    const chat = fakeChat();
    const store = setup(chat);
    store.open('list', null);
    await store.send('코드 짜줘');
    expect(chat.calls).toBe(0);
    expect(store.messages().at(-1)!.kind).toBe('refusal');
  });

  it('가로챈 답은 호출 횟수를 쓰지 않는다', async () => {
    const store = setup();
    store.open('list', null);
    await store.send('주가 알려줘');
    expect(store.turnsUsed()).toBe(0);
  });

  it('모델을 부른 답만 호출 횟수를 센다', async () => {
    const store = setup();
    store.open('list', null);
    await store.send('3일 쉬는데 어디 가지');
    expect(store.turnsUsed()).toBe(1);
  });

  it('랜덤 뽑기는 앱이 답하고 같은 지역을 연달아 주지 않는다', async () => {
    const chat = fakeChat();
    const store = setup(chat);
    store.open('list', null);
    await store.send('아무 데나 뽑아줘');
    const first = store.messages().at(-1)!.text;
    await store.send('아무 데나 뽑아줘');
    const second = store.messages().at(-1)!.text;
    expect(chat.calls).toBe(0);
    expect(first).not.toBe(second);
  });

  it('보내는 동안에는 기다리는 상태가 된다', async () => {
    let release = (): void => {};
    const chat = fakeChat({
      reply: () =>
        new Promise<ChatReply>((resolve) => {
          release = () => resolve(reply());
        }),
    });
    const store = setup(chat);
    store.open('list', null);
    const sending = store.send('어디 갈까');
    expect(store.pending()).toBe(true);
    release();
    await sending;
    expect(store.pending()).toBe(false);
  });

  it('기다리는 동안 다시 보내지 않는다', async () => {
    let release = (): void => {};
    const chat = fakeChat({
      reply: () =>
        new Promise<ChatReply>((resolve) => {
          release = () => resolve(reply());
        }),
    });
    const store = setup(chat);
    store.open('list', null);
    const sending = store.send('어디 갈까');
    await store.send('또 보내기');
    expect(chat.calls).toBe(1);
    release();
    await sending;
  });
});

describe('TravelChatStore 초안', () => {
  const draftChat = () =>
    fakeChat({
      reply: async () =>
        reply({
          kind: 'draft',
          text: '이런 일정은 어떠세요',
          regions: ['강릉'],
          places: [
            { day: 1, name: '안목해변', kind: 'place' },
            { day: 1, name: '없는장소', kind: 'place' },
          ],
        }),
    });

  it('모델이 낸 이름을 장소 검색으로 대조한 뒤 초안을 만든다', async () => {
    const store = setup(draftChat());
    store.open('list', null);
    await store.send('일정 짜줘');
    const draft = store.messages().at(-1)!.draft;
    expect(draft).not.toBeNull();
    expect(draft!.action).toBe('append');
    const places = (draft as { places: { name: string; verified: boolean }[] }).places;
    expect(places.find((p) => p.name === '안목해변')!.verified).toBe(true);
    expect(places.find((p) => p.name === '없는장소')!.verified).toBe(false);
  });

  it('대조로 확인된 장소가 하나도 없으면 빈 결과로 알린다', async () => {
    const chat = fakeChat({
      reply: async () =>
        reply({
          kind: 'draft',
          text: '초안',
          places: [{ day: 1, name: '없는장소', kind: 'place' }],
        }),
    });
    const store = setup(chat);
    store.open('list', null);
    await store.send('일정 짜줘');
    expect(store.messages().at(-1)!.draft).toBeNull();
    expect(store.error()?.kind).toBe('empty');
  });
});

describe('TravelChatStore 적용과 되돌리기', () => {
  it('확인한 변경을 여행에 반영한다', async () => {
    const store = setup();
    const base = trip([stop('a', '가', day1, 0), stop('b', '나', day1, 1)]);
    store.open('trip', base);
    const next = store.applyDraft({ action: 'remove', stopIds: ['a'] });
    expect(next).not.toBeNull();
    expect(next!.stops).toHaveLength(1);
  });

  it('적용한 뒤에는 되돌릴 수 있다', () => {
    const store = setup();
    const base = trip([stop('a', '가', day1, 0), stop('b', '나', day1, 1)]);
    store.open('trip', base);
    store.applyDraft({ action: 'remove', stopIds: ['a'] });
    expect(store.canUndo()).toBe(true);
    const restored = store.undo();
    expect(restored!.stops).toHaveLength(2);
  });

  it('되돌린 뒤에는 다시 되돌릴 것이 없다', () => {
    const store = setup();
    store.open('trip', trip([stop('a', '가', day1, 0)]));
    store.applyDraft({ action: 'remove', stopIds: ['a'] });
    store.undo();
    expect(store.canUndo()).toBe(false);
  });

  it('여행 없이 적용하면 아무 일도 하지 않는다', () => {
    const store = setup();
    store.open('list', null);
    expect(store.applyDraft({ action: 'remove', stopIds: ['a'] })).toBeNull();
  });
});

describe('TravelChatStore 실패 처리', () => {
  it('연결 실패를 구분해 알리고 대화 기록을 지우지 않는다', async () => {
    const chat = fakeChat({
      reply: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const store = setup(chat);
    store.open('list', null);
    await store.send('3일 쉬는데 어디 가지');
    expect(store.error()?.kind).toBe('offline');
    expect(store.messages().some((m) => m.role === 'user')).toBe(true);
  });

  it('한도 초과를 구분한다', async () => {
    const chat = fakeChat({
      reply: async () => {
        throw new Error('오늘 사용량을 모두 썼습니다.');
      },
    });
    const store = setup(chat);
    store.open('list', null);
    await store.send('3일 쉬는데 어디 가지');
    expect(store.error()?.kind).toBe('quota');
  });

  it('시간 초과를 구분한다', async () => {
    const chat = fakeChat({
      reply: async () => {
        throw new Error('응답이 오래 걸립니다.');
      },
    });
    const store = setup(chat);
    store.open('list', null);
    await store.send('3일 쉬는데 어디 가지');
    expect(store.error()?.kind).toBe('timeout');
  });
});

describe('TravelChatStore 호출 상한', () => {
  it('상한에 이르면 더 보내지 않고 안내한다', async () => {
    const chat = fakeChat();
    const store = setup(chat);
    store.open('list', null);
    for (let i = 0; i < CHAT_TURN_LIMIT; i += 1) await store.send('3일 쉬는데 어디 가지');
    expect(store.turnsUsed()).toBe(CHAT_TURN_LIMIT);
    expect(store.atLimit()).toBe(true);

    await store.send('3일 쉬는데 어디 가지');
    expect(chat.calls).toBe(CHAT_TURN_LIMIT);
    expect(store.error()?.kind).toBe('limit');
  });

  it('상한에 이르러도 가로채는 답은 계속 준다', async () => {
    const store = setup();
    store.open('list', null);
    for (let i = 0; i < CHAT_TURN_LIMIT; i += 1) await store.send('3일 쉬는데 어디 가지');
    await store.send('아무 데나 뽑아줘');
    expect(store.messages().at(-1)!.role).toBe('assistant');
  });

  it('새 대화를 시작하면 횟수가 초기화된다', async () => {
    const store = setup();
    store.open('list', null);
    await store.send('3일 쉬는데 어디 가지');
    await store.reset();
    expect(store.turnsUsed()).toBe(0);
    expect(store.messages()).toHaveLength(0);
  });
});
