/**
 * AI 서버 함수가 함께 쓰는 사용자별 하루 한도.
 * 표와 함수는 service_role만 쓸 수 있어, 서버 함수의 관리 클라이언트로 부른다.
 */
export type AiKind = 'plan' | 'chat' | 'receipt';

/** 오늘 이 기능을 한도만큼 썼다. limit은 서버가 실제로 적용한 한도다. */
export class UserLimitError extends Error {
  constructor(readonly limit: number) {
    super('user_limit');
  }
}

interface RpcClient {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { code?: string; details?: string } | null }>;
}

export function quotaDeps(client: RpcClient, kind: AiKind, defaultLimit: number) {
  return {
    /** 한 번을 차감하고 남은 횟수를 돌려준다. */
    async consumeQuota(userId: string): Promise<number> {
      const { data, error } = await client.rpc('consume_ai_quota', {
        p_user: userId,
        p_kind: kind,
        p_default_limit: defaultLimit,
      });
      if (error?.code === 'P0429') {
        // 예외 한도 0도 그대로 알린다. '||'로 기본값을 고르면 0이 기본 한도로 바뀐다.
        const limit = Number(error.details);
        throw new UserLimitError(Number.isInteger(limit) && limit >= 0 ? limit : defaultLimit);
      }
      if (error) throw new Error('quota_check_failed');
      return Number(data);
    },
    /** 모델 호출이 실패했을 때 차감한 한 번을 돌려준다. */
    async refundQuota(userId: string): Promise<void> {
      await client.rpc('refund_ai_quota', { p_user: userId, p_kind: kind });
    },
  };
}

/** 환경변수의 한도. 0 이상의 정수가 아니면 기본값을 쓴다. */
export function limitFromEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}
