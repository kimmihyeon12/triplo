import { describe, expect, it, vi } from 'vitest';
import { createAiPlanHandler } from '../../../../../../supabase/functions/ai-plan/handler';
import { RESPONSE_SCHEMA } from '../../../../../../supabase/functions/ai-plan/prompt';
import { UserLimitError } from '../../../../../../supabase/functions/_shared/quota';

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
    consumeQuota?: (userId: string) => Promise<number>;
  } = {},
) {
  const callModel = overrides.callModel ?? vi.fn(async () => JSON.stringify({ items: [] }));
  const consumeQuota = vi.fn(overrides.consumeQuota ?? (async () => 4));
  const refundQuota = vi.fn(async () => {});
  return {
    callModel,
    consumeQuota,
    refundQuota,
    handler: createAiPlanHandler({
      getUser: overrides.getUser ?? (async () => ({ id: 'u1' })),
      callModel,
      consumeQuota,
      refundQuota,
    }),
  };
}

describe('createAiPlanHandler', () => {
  it('1인 예산과 전체 예산을 구별해 생성 조건으로 전달한다', async () => {
    const { handler, callModel } = setup();
    expect((await handler(post({ ...BODY, partySize: 3, budget: 100000, budgetBasis: 'person' }))).status).toBe(200);
    const prompt = (callModel as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(prompt.user).toContain('3명');
    expect(prompt.user).toContain('100000원 (1인 기준)');
    expect(prompt.user).toContain('총예산 300000원');
  });
  it.each([{ partySize: 0 }, { partySize: 1.5 }, { budget: -1 }, { budget: '10000' }, { budgetBasis: 'night' }])('잘못된 예산 조건을 모델 호출 전에 거절한다: %j', async (extra) => {
    const { handler, callModel } = setup();
    expect((await handler(post({ ...BODY, ...extra }))).status).toBe(400);
    expect(callModel).not.toHaveBeenCalled();
  });
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
    expect(await res.json()).toEqual({ content, remaining: 4 });
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

  it('성공하면 한 번을 차감하고 남은 횟수를 함께 돌려준다', async () => {
    const { handler, consumeQuota } = setup();
    const res = await handler(post(BODY));
    expect(res.status).toBe(200);
    expect((await res.json()).remaining).toBe(4);
    expect(consumeQuota).toHaveBeenCalledWith('u1');
  });

  it('내 한도를 넘으면 모델을 부르지 않고 429 user_limit과 한도를 돌려준다', async () => {
    const { handler, callModel } = setup({
      consumeQuota: async () => {
        throw new UserLimitError(5);
      },
    });
    const res = await handler(post(BODY));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'user_limit', limit: 5 });
    expect(callModel).not.toHaveBeenCalled();
  });

  it('입력이 잘못되면 차감하지 않는다', async () => {
    const { handler, consumeQuota } = setup();
    expect((await handler(post({ ...BODY, regions: [] }))).status).toBe(400);
    expect(consumeQuota).not.toHaveBeenCalled();
  });

  it('모델이 실패하면 차감한 한 번을 되돌린다', async () => {
    for (const message of ['quota_exceeded', 'model_error_500']) {
      const { handler, refundQuota } = setup({
        callModel: async () => {
          throw new Error(message);
        },
      });
      await handler(post(BODY));
      expect(refundQuota).toHaveBeenCalledWith('u1');
    }
  });

  it('한도 확인이 실패하면 503 server_unavailable이고 모델을 부르지 않는다', async () => {
    const { handler, callModel, refundQuota } = setup({
      consumeQuota: async () => {
        throw new Error('quota_check_failed');
      },
    });
    const res = await handler(post(BODY));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'server_unavailable' });
    expect(callModel).not.toHaveBeenCalled();
    expect(refundQuota).not.toHaveBeenCalled();
  });

  it('모델이 빈 답을 주면 실패로 알리고 되돌린다', async () => {
    const { handler, refundQuota } = setup({ callModel: async () => '  ' });
    expect((await handler(post(BODY))).status).toBe(500);
    expect(refundQuota).toHaveBeenCalledWith('u1');
  });
});

describe('AI 코스 프롬프트', () => {
  it('코스 형식과 기본 분류 구성을 모델에 요구한다', async () => {
    const { handler, callModel } = setup();
    await handler(post({ ...BODY, dayCount: 2 }));
    const prompt = (callModel as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(prompt.system).toContain('관광·액티비티·식사·카페·쇼핑·기타·숙소');
    expect(prompt.system).toContain('마지막 날에는 숙소를 넣지 않는다');
    expect(prompt.user).toContain('관광·액티비티·쇼핑을 합쳐 2~3곳');
    expect(prompt.user).toContain('카페 1곳');
    expect(prompt.user).not.toContain('카페 2곳씩');
  });
  it('일정 밀도에 따라 하루 관광 수를 달리 요구한다(식사 2·카페 1은 같다)', async () => {
    for (const [pace, range] of [['여유롭게', '1~2곳'], ['보통', '2~3곳'], ['알차게', '3~4곳']] as const) {
      const { handler, callModel } = setup();
      await handler(post({ ...BODY, pace }));
      const user = (callModel as ReturnType<typeof vi.fn>).mock.calls[0]![0].user as string;
      expect(user).toContain(`관광·액티비티·쇼핑을 합쳐 ${range}`);
      expect(user).toContain('식사 2곳');
    }
  });
  it('추가 요청이 범위를 정하면 기본 구성을 넣지 않는다', async () => {
    const { handler, callModel } = setup();
    await handler(post({ ...BODY, extraNote: '맛집만 5곳' }));
    expect((callModel as ReturnType<typeof vi.fn>).mock.calls[0]![0].user).not.toContain('관광·액티비티·쇼핑을 합쳐');
  });
  it('응답 스키마가 코스 필드와 일곱 분류를 가진다', () => {
    const item = RESPONSE_SCHEMA.properties.items.items;
    expect(item.properties.kind.enum).toEqual(['관광', '액티비티', '식사', '카페', '쇼핑', '기타', '숙소']);
    expect(item.required).toEqual(expect.arrayContaining(['day', 'order', 'name', 'kind', 'start', 'estimate']));
    expect(item.properties.moveToNext.properties.mode.enum).toEqual(['도보', '대중교통', '자가용', '택시']);
  });
});

describe('AI 코스 휴무 정보', () => {
  it('시작일이 있으면 일차별 날짜와 요일을 알려 준다', async () => {
    const { handler, callModel } = setup();
    await handler(post({ ...BODY, dayCount: 2, startDate: '2026-10-01' }));
    const prompt = (callModel as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(prompt.user).toContain('1일차 2026-10-01(목)');
    expect(prompt.user).toContain('2일차 2026-10-02(금)');
    expect(prompt.system).toContain('휴무');
  });
  it('시작일이 없으면 날짜를 쓰지 않는다', async () => {
    const { handler, callModel } = setup();
    await handler(post({ ...BODY }));
    expect((callModel as ReturnType<typeof vi.fn>).mock.calls[0]![0].user).not.toContain('1일차 20');
  });
  it.each(['2026-13-01', '10/01', 20261001])('잘못된 시작일은 거절한다: %s', async (startDate) => {
    const { handler, callModel } = setup();
    expect((await handler(post({ ...BODY, startDate }))).status).toBe(400);
    expect(callModel).not.toHaveBeenCalled();
  });
  it('응답 스키마에 휴무 정보가 있다', () => {
    const item = RESPONSE_SCHEMA.properties.items.items;
    expect(item.properties.closed).toMatchObject({ nullable: true, required: ['onDay', 'note'] });
  });
});

describe('AI 코스 프롬프트 품질(2026-09-30 실제 생성 확인)', () => {
  it('무료인 곳은 0원으로 적게 한다', async () => {
    const { handler, callModel } = setup();
    await handler(post(BODY));
    expect((callModel as ReturnType<typeof vi.fn>).mock.calls[0]![0].system).toContain('입장료가 없는 곳은 cost를 min=0, max=0');
  });
  it('휴무일이 없는 곳에는 closed를 쓰지 않게 한다', async () => {
    const { handler, callModel } = setup();
    await handler(post(BODY));
    expect((callModel as ReturnType<typeof vi.fn>).mock.calls[0]![0].system).toContain('상시 영업이거나 휴무일이 없으면 closed=null');
  });
  it('예산이 있으면 예산 수준에 맞는 곳을 고르게 한다', async () => {
    const { handler, callModel } = setup();
    await handler(post({ ...BODY, budget: 500000 }));
    expect((callModel as ReturnType<typeof vi.fn>).mock.calls[0]![0].system).toContain('숙소·식당은 예산 수준에 맞는 곳을 고른다');
  });
});

describe('AI 코스 당일치기', () => {
  it('당일치기면 숙소를 넣지 말라고 알린다', async () => {
    const { handler, callModel } = setup();
    await handler(post({ ...BODY, dayCount: 1 }));
    const user = (callModel as ReturnType<typeof vi.fn>).mock.calls[0]![0].user;
    expect(user).toContain('당일치기라 숙소는 넣지 않는다');
    expect(user).not.toContain('숙소 1곳을 그날 마지막에');
  });
  it('추가 요청이 범위를 정해도 당일치기 규칙은 남긴다', async () => {
    const { handler, callModel } = setup();
    await handler(post({ ...BODY, dayCount: 1, extraNote: '맛집만 3곳' }));
    expect((callModel as ReturnType<typeof vi.fn>).mock.calls[0]![0].user).toContain('당일치기라 숙소는 넣지 않는다');
  });
});

describe('AI 코스 꼭 갈 장소', () => {
  it('꼭 갈 장소는 지역 밖이어도 반드시 넣고 정식 상호로 적게 한다', async () => {
    const { handler, callModel } = setup();
    await handler(post({ ...BODY, mustGo: '수원 신가회전훠궈' }));
    const prompt = (callModel as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(prompt.system).toContain('꼭 갈 장소는 요청 지역 밖이어도 반드시 코스에 넣는다');
    expect(prompt.user).toContain('꼭 갈 장소(반드시 포함): 수원 신가회전훠궈');
  });
});

describe('AI 코스 식사 규칙(2026-09-30 카페 요청에 식사가 빠진 것 확인)', () => {
  const user = async (extra: object) => {
    const { handler, callModel } = setup();
    await handler(post({ ...BODY, ...extra }));
    return (callModel as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { system: string; user: string };
  };
  it('추가 요청이 범위를 정해도 하루 식사 2곳을 반드시 넣게 한다', async () => {
    const prompt = await user({ extraNote: '예쁜 카페 위주로' });
    expect(prompt.user).toContain('하루 식사 2곳(점심 12시쯤, 저녁 18시쯤)은 추가 요청과 관계없이 반드시 넣는다');
    expect(prompt.user).not.toContain('다른 어떤 지시보다');
  });
  it('식사 시각은 다른 일정 때문에 1~2시간 늦어져도 된다고 알린다', async () => {
    const prompt = await user({});
    expect(prompt.system).toContain('점심은 12:00~14:00, 저녁은 18:00~20:00');
    expect(prompt.user).toContain('하루 식사 2곳(점심 12시쯤, 저녁 18시쯤)');
  });
});
