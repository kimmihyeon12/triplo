import { describe, expect, it, vi } from 'vitest';
import {
  limitFromEnv,
  quotaDeps,
  UserLimitError,
} from '../../../../../../supabase/functions/_shared/quota';

function client(result: { data: unknown; error: { code?: string; details?: string } | null }) {
  return { rpc: vi.fn(async () => result) };
}

describe('quotaDeps', () => {
  it('남은 횟수를 돌려주고 기능·기본 한도를 함께 보낸다', async () => {
    const c = client({ data: 4, error: null });
    expect(await quotaDeps(c, 'plan', 5).consumeQuota('u1')).toBe(4);
    expect(c.rpc).toHaveBeenCalledWith('consume_ai_quota', { p_user: 'u1', p_kind: 'plan', p_default_limit: 5 });
  });

  it('P0429면 서버가 적용한 한도를 담아 UserLimitError를 던진다', async () => {
    const c = client({ data: null, error: { code: 'P0429', details: '7' } });
    const error = await quotaDeps(c, 'chat', 30).consumeQuota('u1').catch((e) => e);
    expect(error).toBeInstanceOf(UserLimitError);
    expect(error.message).toBe('user_limit');
    expect(error.limit).toBe(7);
  });

  it('예외 한도 0도 그대로 알린다', async () => {
    const c = client({ data: null, error: { code: 'P0429', details: '0' } });
    const error = await quotaDeps(c, 'plan', 5).consumeQuota('u1').catch((e) => e);
    expect(error.limit).toBe(0);
  });

  it('그 밖의 오류는 quota_check_failed', async () => {
    const c = client({ data: null, error: { code: '42501' } });
    await expect(quotaDeps(c, 'receipt', 10).consumeQuota('u1')).rejects.toThrow('quota_check_failed');
  });

  it('되돌리기는 refund_ai_quota를 부른다', async () => {
    const c = client({ data: null, error: null });
    await quotaDeps(c, 'receipt', 10).refundQuota('u1');
    expect(c.rpc).toHaveBeenCalledWith('refund_ai_quota', { p_user: 'u1', p_kind: 'receipt' });
  });
});

describe('limitFromEnv', () => {
  it('0 이상의 정수만 받고 아니면 기본값', () => {
    expect(limitFromEnv('12', 5)).toBe(12);
    expect(limitFromEnv('0', 5)).toBe(0);
    expect(limitFromEnv(undefined, 5)).toBe(5);
    expect(limitFromEnv('', 5)).toBe(5);
    expect(limitFromEnv('-1', 5)).toBe(5);
    expect(limitFromEnv('2.5', 5)).toBe(5);
  });
});
