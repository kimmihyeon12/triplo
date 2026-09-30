import { describe, expect, it, vi } from 'vitest';
import {
  createReceiptScanHandler,
  MAX_IMAGE_CHARS,
} from '../../../../../../supabase/functions/receipt-scan/handler';
import { UserLimitError } from '../../../../../../supabase/functions/_shared/quota';

/**
 * Edge Function 핸들러를 앱 테스트에서 그대로 검증한다. ai-plan과 같은 구조다.
 */

const BODY = { image: 'aGVsbG8=', mimeType: 'image/jpeg', highlighted: false };

function post(body: unknown, token = 'good-token'): Request {
  return new Request('https://example.test/receipt-scan', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function setup(
  overrides: {
    getUser?: (token: string) => Promise<{ id: string } | null>;
    callModel?: (r: { system: string; image: string; mimeType: string }) => Promise<string>;
    consumeQuota?: (userId: string) => Promise<number>;
  } = {},
) {
  const callModel = overrides.callModel ?? vi.fn(async () => '{"store":"","total":0,"items":[]}');
  const consumeQuota = vi.fn(overrides.consumeQuota ?? (async () => 9));
  const refundQuota = vi.fn(async () => {});
  return {
    callModel,
    consumeQuota,
    refundQuota,
    handler: createReceiptScanHandler({
      getUser: overrides.getUser ?? (async () => ({ id: 'u1' })),
      callModel,
      consumeQuota,
      refundQuota,
    }),
  };
}

describe('createReceiptScanHandler', () => {
  it('로그인하지 않으면 거절한다', async () => {
    const { handler, callModel } = setup();
    const res = await handler(
      new Request('https://example.test/receipt-scan', { method: 'POST', body: '{}' }),
    );
    expect(res.status).toBe(401);
    expect(callModel).not.toHaveBeenCalled();
  });

  it('토큰이 유효하지 않으면 거절한다', async () => {
    const { handler } = setup({ getUser: async () => null });
    expect((await handler(post(BODY))).status).toBe(401);
  });

  it('사진 형식이 허용 목록에 없으면 거절한다', async () => {
    const { handler } = setup();
    const res = await handler(post({ ...BODY, mimeType: 'image/gif' }));
    expect(res.status).toBe(400);
  });

  it('base64가 아닌 본문은 거절한다', async () => {
    const { handler } = setup();
    expect((await handler(post({ ...BODY, image: 'data:image/jpeg;base64,xx' }))).status).toBe(400);
  });

  it('너무 큰 사진은 413으로 거절한다', async () => {
    const { handler, callModel } = setup();
    const res = await handler(post({ ...BODY, image: 'A'.repeat(MAX_IMAGE_CHARS + 1) }));
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe('image_too_large');
    expect(callModel).not.toHaveBeenCalled();
  });

  it('형광펜을 칠했을 때만 칠한 줄만 읽으라는 규칙을 붙인다', async () => {
    const { handler, callModel } = setup();
    await handler(post(BODY));
    await handler(post({ ...BODY, highlighted: true }));
    const calls = vi.mocked(callModel).mock.calls;
    expect(calls[0][0].system).not.toContain('형광펜');
    expect(calls[1][0].system).toContain('형광펜이 덮은 줄만');
    expect(calls[1][0].image).toBe(BODY.image);
  });

  it('모델 응답을 그대로 content로 돌려준다', async () => {
    const { handler } = setup({ callModel: async () => '{"items":[1]}' });
    const res = await handler(post(BODY));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ content: '{"items":[1]}', remaining: 9 });
  });

  it('하루 한도 초과는 429로 알린다', async () => {
    const { handler } = setup({
      callModel: async () => {
        throw new Error('quota_exceeded');
      },
    });
    expect((await handler(post(BODY))).status).toBe(429);
  });

  it('그 밖의 모델 오류는 500 scan_failed로 알린다', async () => {
    const { handler } = setup({
      callModel: async () => {
        throw new Error('model_error_503');
      },
    });
    const res = await handler(post(BODY));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('scan_failed');
  });

  it('성공하면 차감하고 남은 횟수를 돌려준다', async () => {
    const { handler, consumeQuota } = setup();
    const res = await handler(post(BODY));
    expect((await res.json()).remaining).toBe(9);
    expect(consumeQuota).toHaveBeenCalledWith('u1');
  });

  it('너무 큰 사진·잘못된 형식은 차감하지 않는다', async () => {
    const { handler, consumeQuota } = setup();
    expect((await handler(post({ ...BODY, image: 'A'.repeat(MAX_IMAGE_CHARS + 1) }))).status).toBe(413);
    expect((await handler(post({ ...BODY, mimeType: 'image/gif' }))).status).toBe(400);
    expect(consumeQuota).not.toHaveBeenCalled();
  });

  it('내 한도를 넘으면 사진을 읽지 않고 429 user_limit', async () => {
    const { handler, callModel } = setup({
      consumeQuota: async () => {
        throw new UserLimitError(10);
      },
    });
    const res = await handler(post(BODY));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'user_limit', limit: 10 });
    expect(callModel).not.toHaveBeenCalled();
  });

  it('모델이 실패하면 되돌린다', async () => {
    const { handler, refundQuota } = setup({
      callModel: async () => {
        throw new Error('quota_exceeded');
      },
    });
    expect((await handler(post(BODY))).status).toBe(429);
    expect(refundQuota).toHaveBeenCalledWith('u1');
  });

  it('한도 확인이 실패하면 503', async () => {
    const { handler, callModel } = setup({
      consumeQuota: async () => {
        throw new Error('quota_check_failed');
      },
    });
    expect((await handler(post(BODY))).status).toBe(503);
    expect(callModel).not.toHaveBeenCalled();
  });

  it('모델이 빈 답을 주면 실패로 알리고 되돌린다', async () => {
    const { handler, refundQuota } = setup({ callModel: async () => '' });
    expect((await handler(post(BODY))).status).toBe(500);
    expect(refundQuota).toHaveBeenCalledWith('u1');
  });
});
