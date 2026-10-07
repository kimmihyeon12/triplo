/**
 * Gemini 실제 호출을 ai_calls에 남긴다(2026-10-07 관리자 사용량 화면).
 * 무료 키에는 사용량 조회 API가 없어 부를 때 직접 센다. 실패한 호출도 무료 한도에 들어가므로 남긴다.
 */
import type { AiKind } from './quota.ts';

export interface TokenUsage {
  input: number;
  output: number;
}

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0;

/** 응답 본문의 usageMetadata에서 토큰을 읽는다. 생각 토큰은 출력 요금이라 출력에 더한다. */
export function tokenUsage(body: unknown): TokenUsage {
  const meta = (body as { usageMetadata?: Record<string, unknown> } | null)?.usageMetadata;
  if (!meta || typeof meta !== 'object') return { input: 0, output: 0 };
  return {
    input: count(meta['promptTokenCount']),
    output: count(meta['candidatesTokenCount']) + count(meta['thoughtsTokenCount']),
  };
}

interface InsertClient {
  from(table: string): { insert(row: Record<string, unknown>): PromiseLike<{ error: unknown }> };
}

/** 호출 한 번의 결과를 남기는 함수를 돌려준다. 기록 실패는 삼킨다. 기록 때문에 사용자 요청이 실패하면 안 된다. */
export function callRecorder(client: InsertClient, kind: AiKind, model: string) {
  return async (ok: boolean, tokens: TokenUsage = { input: 0, output: 0 }): Promise<void> => {
    try {
      const { error } = await client.from('ai_calls').insert({
        kind,
        model,
        ok,
        input_tokens: tokens.input,
        output_tokens: tokens.output,
      });
      if (error) console.error('ai_calls insert failed', error);
    } catch (error) {
      console.error('ai_calls insert failed', error);
    }
  };
}
