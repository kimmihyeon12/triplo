import { describe, expect, it, vi } from 'vitest';
import { createAiPlanHandler } from '../../../../../../supabase/functions/ai-plan/handler';

/**
 * Edge Function의 핸들러를 앱 테스트에서 그대로 검증한다. delete-account와 같은
 * 구조다. 실제 배포된 함수와 같은 코드이므로 여기서 잡은 결함이 곧 서버의 결함이다.
 */

const BODY = {
  regions: ['경주'],
  dayCount: 2,
  companion: '친구',
  transport: '자가용',
  pace: '보통',
  taste: '',
  mustGo: '',
  bookedStay: '',
  extraNote: '',
};

function post(body: unknown, token = 'good-token'): Request {
  return new Request('https://example.test/ai-plan', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function setup(
  overrides: {
    getUser?: (token: string) => Promise<{ id: string } | null>;
    callModel?: (prompt: { system: string; user: string }) => Promise<string>;
  } = {},
) {
  const callModel = overrides.callModel ?? vi.fn(async () => JSON.stringify({ items: [] }));
  return {
    callModel,
    handler: createAiPlanHandler({
      getUser: overrides.getUser ?? (async () => ({ id: 'u1' })),
      callModel,
    }),
  };
}

describe('createAiPlanHandler', () => {
  it('로그인하지 않으면 거절한다', async () => {
    const { handler } = setup();
    const res = await handler(
      new Request('https://example.test/ai-plan', { method: 'POST', body: '{}' }),
    );
    expect(res.status).toBe(401);
  });

  it('토큰이 유효하지 않으면 거절한다', async () => {
    const { handler } = setup({ getUser: async () => null });
    expect((await handler(post(BODY))).status).toBe(401);
  });

  it('POST가 아니면 거절한다', async () => {
    const { handler } = setup();
    const res = await handler(
      new Request('https://example.test/ai-plan', { method: 'GET' }),
    );
    expect(res.status).toBe(405);
  });

  it('사전 요청에는 허용 헤더를 돌려준다', async () => {
    const { handler } = setup();
    const res = await handler(
      new Request('https://example.test/ai-plan', { method: 'OPTIONS' }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('지역이 없으면 거절한다', async () => {
    const { handler } = setup();
    const res = await handler(post({ ...BODY, regions: [] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_request');
  });

  it('일수가 범위를 벗어나면 거절한다', async () => {
    const { handler } = setup();
    expect((await handler(post({ ...BODY, dayCount: 0 }))).status).toBe(400);
    expect((await handler(post({ ...BODY, dayCount: 100 }))).status).toBe(400);
  });

  it('모델이 낸 내용을 그대로 돌려준다', async () => {
    const content = JSON.stringify({ items: [{ day: 1, name: '불국사', kind: '장소' }] });
    const { handler } = setup({ callModel: async () => content });
    const res = await handler(post(BODY));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ content });
  });

  it('조건을 프롬프트에 담아 모델을 부른다', async () => {
    const { handler, callModel } = setup();
    await handler(post({ ...BODY, taste: '바다', extraNote: '맛집 3개만' }));
    const prompt = (callModel as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      system: string;
      user: string;
    };
    expect(prompt.user).toContain('경주');
    expect(prompt.user).toContain('바다');
    expect(prompt.user).toContain('맛집 3개만');
    expect(prompt.system).toContain('고유명사');
  });

  it('모델 호출이 실패하면 500으로 알린다', async () => {
    const { handler } = setup({
      callModel: async () => {
        throw new Error('boom');
      },
    });
    const res = await handler(post(BODY));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('generation_failed');
  });

  it('하루 한도를 넘기면 그 사정을 구분해 알린다', async () => {
    const { handler } = setup({
      callModel: async () => {
        throw new Error('quota_exceeded');
      },
    });
    const res = await handler(post(BODY));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('quota_exceeded');
  });

  it('본문이 JSON이 아니면 거절한다', async () => {
    const { handler } = setup();
    const res = await handler(
      new Request('https://example.test/ai-plan', {
        method: 'POST',
        headers: { authorization: 'Bearer good-token' },
        body: '이건 JSON이 아닙니다',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('지나치게 긴 입력은 잘라 보낸다', async () => {
    const { handler, callModel } = setup();
    await handler(post({ ...BODY, extraNote: '가'.repeat(5000) }));
    const prompt = (callModel as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { user: string };
    // 긴 입력을 그대로 보내면 토큰만 쓰고 결과는 나아지지 않는다.
    expect(prompt.user.length).toBeLessThan(2000);
  });
});
