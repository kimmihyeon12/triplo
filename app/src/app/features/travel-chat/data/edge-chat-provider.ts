import { inject, Injectable } from '@angular/core';
import { AuthStore } from '../../auth/data/auth-store';
import { AiQuota, aiLimitMessage } from '../../../core/ai-quota';
import type { ChatReply } from '../model/chat';
import type { ChatProvider, ChatRequest } from './chat-provider';
import { normalizeChatResponse } from '../../../../../../supabase/functions/ai-chat/contract';

@Injectable({providedIn:'root'})
export class EdgeChatProvider implements ChatProvider {
  private readonly auth = inject(AuthStore);
  private readonly quota = inject(AiQuota);

  async availability() {
    return {available:this.auth.available(),reason:this.auth.available()?null:'AI 서버에 연결되지 않았어요. 잠시 후 다시 시도해 주세요.'};
  }

  async reply(request: ChatRequest, signal: AbortSignal): Promise<ChatReply> {
    signal.throwIfAborted();
    try {
      const {content,remaining} = await this.auth.callFunction<{content:string;remaining?:number}>('ai-chat',{
        input:request.input,scope:request.scope,history:request.history,trip:request.trip,
        ...(request.candidates?.length ? {candidates:request.candidates} : {}),
      }, signal);
      signal.throwIfAborted();
      this.quota.record('chat',remaining);
      // 앱도 같은 계약으로 다시 검사한다. 보낸 후보에 없는 번호는 여기서도 버린다.
      return normalizeChatResponse(content, request.candidates ?? []);
    } catch (error) {
      if (signal.aborted) throw error;
      const limit = aiLimitMessage('chat',error);
      if (limit) throw new Error(limit);
      const code = error instanceof Error ? error.message : '';
      const messages: Record<string,string> = {
        authentication_required:'로그인이 필요해요. 다시 로그인해 주세요.',
        invalid_request:'질문이나 여행 문맥이 너무 길어요. 짧게 나누어 다시 질문해 주세요.',
        model_timeout:'응답이 오래 걸립니다. 잠시 후 다시 시도해 주세요.',
        server_unavailable:'AI 서버에 연결하지 못했어요. 서버 설정을 확인해 주세요.',
      };
      throw new Error(messages[code] ?? 'AI 답변을 받지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  }
}
