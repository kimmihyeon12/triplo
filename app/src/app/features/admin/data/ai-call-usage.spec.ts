import { describe, expect, it, vi } from 'vitest';
import { callRecorder, tokenUsage } from '../../../../../../supabase/functions/_shared/usage';

/** 서버 함수의 호출 기록 코드를 앱 테스트에서 그대로 검증한다. quota.ts와 같은 방식이다. */
describe('tokenUsage', () => {
  it('입력 토큰과 출력·생각 토큰 합을 읽는다', () => {
    expect(tokenUsage({ usageMetadata: { promptTokenCount: 400, candidatesTokenCount: 250, thoughtsTokenCount: 50 } }))
      .toEqual({ input: 400, output: 300 });
  });
  it.each([null, undefined, 'x', {}, { usageMetadata: { promptTokenCount: -3, candidatesTokenCount: 'a' } }])(
    '값이 없거나 이상하면 0이다: %j',
    (body) => expect(tokenUsage(body)).toEqual({ input: 0, output: 0 }),
  );
});

describe('callRecorder', () => {
  it('기능·모델·성공 여부·토큰을 ai_calls에 넣는다', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn(() => ({ insert })) };
    await callRecorder(client, 'chat', 'gemini-3.5-flash-lite')(true, { input: 10, output: 5 });
    expect(client.from).toHaveBeenCalledWith('ai_calls');
    expect(insert).toHaveBeenCalledWith({ kind: 'chat', model: 'gemini-3.5-flash-lite', ok: true, input_tokens: 10, output_tokens: 5 });
  });
  it('넣기에 실패하거나 예외가 나도 사용자 요청을 막지 않는다', async () => {
    const failing = { from: () => ({ insert: () => Promise.resolve({ error: { message: 'down' } }) }) };
    const throwing = { from: () => ({ insert: () => Promise.reject(new Error('network')) }) };
    await expect(callRecorder(failing, 'plan', 'm')(false)).resolves.toBeUndefined();
    await expect(callRecorder(throwing, 'plan', 'm')(false)).resolves.toBeUndefined();
  });
});
