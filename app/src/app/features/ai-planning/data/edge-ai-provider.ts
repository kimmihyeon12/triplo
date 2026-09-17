import { inject, Injectable } from '@angular/core';
import { AuthStore } from '../../auth/data/auth-store';
import { parseAiItems, type AiItem } from '../util/ai-response';
import type { AiPlanAvailability, AiPlanProvider, AiPlanRequest } from './ai-plan-provider';

/**
 * Supabase Edge Function을 거쳐 일정 초안을 받는다. 모델 키는 서버에만 있고
 * 브라우저에는 들어가지 않는다. 로그인한 사람만 쓸 수 있다.
 *
 * 브라우저가 보내는 것은 사용자가 고른 조건뿐이다. 지시문과 모델 이름은
 * 서버가 갖는다. 요청을 바꿔 모델에게 다른 일을 시키지 못하게 하기 위해서다.
 */

@Injectable({ providedIn: 'root' })
export class EdgeAiProvider implements AiPlanProvider {
  private readonly auth = inject(AuthStore);

  async availability(): Promise<AiPlanAvailability> {
    if (!this.auth.available())
      return {
        available: false,
        reason: 'AI 서버에 연결되지 않았습니다. 잠시 후 다시 시도해 주세요.',
      };
    return { available: true, reason: null };
  }

  async generate(request: AiPlanRequest, signal: AbortSignal): Promise<readonly AiItem[]> {
    try {
      const { content } = await this.auth.callFunction<{ content: string }>('ai-plan', {
        regions: [...request.regions],
        dayCount: request.dayCount,
        companion: request.companion,
        transport: request.transport,
        pace: request.pace,
        taste: request.taste,
        mustGo: request.mustGo,
        bookedStay: request.bookedStay,
        extraNote: request.extraNote,
      });
      if (signal.aborted) return [];
      return parseAiItems(content ?? '', request.dayCount);
    } catch (error) {
      if (signal.aborted) throw error;
      throw toUserError(error);
    }
  }
}

/** 서버가 준 코드를 사용자가 읽을 문장으로 바꾼다. */
function toUserError(error: unknown): Error {
  const code = error instanceof Error ? error.message : '';
  switch (code) {
    case 'quota_exceeded':
      return new Error('오늘 사용량을 다 썼어요. 내일 다시 시도해 주세요.');
    case 'authentication_required':
      return new Error('로그인이 필요합니다. 다시 로그인해 주세요.');
    case 'invalid_request':
      return new Error('조건을 다시 확인해 주세요.');
    case 'server_unavailable':
      return new Error('AI 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
    default:
      return new Error('일정을 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
}
