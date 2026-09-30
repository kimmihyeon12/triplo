import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../auth/data/auth-store';
import { EdgeAiProvider } from './edge-ai-provider';
import type { AiPlanRequest } from './ai-plan-provider';
import { AiQuota } from '../../../core/ai-quota';
import { FunctionError } from '../../auth/data/function-error';

const REQUEST: AiPlanRequest = {
  regions: ['경주'],
  dayCount: 2,
  companion: '연인',
  transport: '대중교통',
  pace: '여유롭게',
  taste: '',
  mustGo: '',
  bookedStay: '',
  extraNote: '',
};

interface FakeAuth {
  available: () => boolean;
  callFunction: ReturnType<typeof vi.fn>;
}

function setup(overrides: Partial<FakeAuth> = {}): {
  provider: EdgeAiProvider;
  auth: FakeAuth;
  quota: AiQuota;
} {
  const auth: FakeAuth = {
    available: () => true,
    callFunction: vi.fn(async () => ({ content: '{"items":[]}' })),
    ...overrides,
  };
  const injector = Injector.create({
    providers: [{ provide: AuthStore, useValue: auth }, AiQuota, EdgeAiProvider],
  });
  return {
    provider: runInInjectionContext(injector, () => injector.get(EdgeAiProvider)),
    auth,
    quota: injector.get(AiQuota),
  };
}

describe('EdgeAiProvider', () => {
  it('서버가 준비되면 사용할 수 있다고 알린다', async () => {
    expect(await setup().provider.availability()).toEqual({ available: true, reason: null });
  });

  it('서버가 연결되지 않았으면 이유를 알린다', async () => {
    const status = await setup({ available: () => false }).provider.availability();
    expect(status.available).toBe(false);
    expect(status.reason).toContain('서버');
  });

  it('모델 응답을 우리 형식으로 바꾼다', async () => {
    const { provider } = setup({
      callFunction: vi.fn(async () => ({
        content: JSON.stringify({
          items: [
            { day: 1, name: '불국사', kind: '장소' },
            { day: 1, name: '함양집', kind: '식사' },
          ],
        }),
      })),
    });
    expect(await provider.generate(REQUEST, new AbortController().signal)).toEqual([
      { day: 1, order: 1, start: null, moveToNext: null, closed: null, name: '불국사', kind: 'place' },
      { day: 1, order: 2, start: null, moveToNext: null, closed: null, name: '함양집', kind: 'meal' },
    ]);
  });

  it('조건만 보내고 지시문은 보내지 않는다', async () => {
    const { provider, auth } = setup();
    await provider.generate(REQUEST, new AbortController().signal);
    const [name, body] = auth.callFunction.mock.calls[0]!;
    expect(name).toBe('ai-plan');
    expect(body).toMatchObject({ regions: ['경주'], dayCount: 2, companion: '연인' });
    // 지시문은 서버가 갖는다. 브라우저가 보내면 바꿔서 다른 일을 시킬 수 있다.
    expect(JSON.stringify(body)).not.toContain('고유명사');
  });

  it('하루 한도를 넘기면 그 사정을 알린다', async () => {
    const { provider } = setup({
      callFunction: vi.fn(async () => {
        throw new Error('quota_exceeded');
      }),
    });
    await expect(provider.generate(REQUEST, new AbortController().signal)).rejects.toThrow(
      /오늘 AI 무료 사용량이 모두 소진됐어요/,
    );
  });

  it('로그인이 풀렸으면 그 사정을 알린다', async () => {
    const { provider } = setup({
      callFunction: vi.fn(async () => {
        throw new Error('authentication_required');
      }),
    });
    await expect(provider.generate(REQUEST, new AbortController().signal)).rejects.toThrow(
      /로그인/,
    );
  });

  it('응답이 비어 있으면 빈 목록을 낸다', async () => {
    const { provider } = setup({ callFunction: vi.fn(async () => ({ content: '' })) });
    expect(await provider.generate(REQUEST, new AbortController().signal)).toEqual([]);
  });

  it('여행 기간을 벗어난 일차는 버린다', async () => {
    const { provider } = setup({
      callFunction: vi.fn(async () => ({
        content: JSON.stringify({
          items: [
            { day: 1, name: '있음', kind: '장소' },
            { day: 9, name: '기간 밖', kind: '장소' },
          ],
        }),
      })),
    });
    const items = await provider.generate(REQUEST, new AbortController().signal);
    expect(items.map((i) => i.name)).toEqual(['있음']);
  });

  it('성공하면 남은 횟수를 기록한다', async () => {
    const { provider, quota } = setup({
      callFunction: vi.fn(async () => ({ content: '{"items":[]}', remaining: 2 })),
    });
    await provider.generate(REQUEST, new AbortController().signal);
    expect(quota.hint('plan')()).toBe('오늘 2번 남음');
  });

  it('내 한도 초과는 서버 한도로 알린다', async () => {
    const { provider } = setup({
      callFunction: vi.fn(async () => {
        throw new FunctionError('user_limit', { error: 'user_limit', limit: 5 });
      }),
    });
    await expect(provider.generate(REQUEST, new AbortController().signal)).rejects.toThrow(
      '오늘 AI 일정 만들기를 5번 모두 썼어요. 내일 0시에 다시 쓸 수 있어요.',
    );
  });
});

describe('EdgeAiProvider 시작일', () => {
  it('시작일을 함께 보낸다', async () => {
    const { provider, auth } = setup();
    await provider.generate({ ...REQUEST, startDate: '2026-10-01' }, new AbortController().signal);
    expect(auth.callFunction.mock.calls[0]![1]).toMatchObject({ startDate: '2026-10-01' });
  });
});
