import { inject, Injectable } from '@angular/core';
import { AuthStore } from '../../auth/data/auth-store';
import type { ChatReply } from '../model/chat';
import type { ChatProvider, ChatRequest } from './chat-provider';
import { normalizeChatResponse } from '../../../../../../supabase/functions/ai-chat/contract';

@Injectable({providedIn:'root'})
export class EdgeChatProvider implements ChatProvider {
  private readonly auth = inject(AuthStore);

  async availability() {
    return {available:this.auth.available(),reason:this.auth.available()?null:'AI 서버에 연결되지 않았어요. 잠시 후 다시 시도해 주세요.'};
  }

  async reply(request: ChatRequest, signal: AbortSignal): Promise<ChatReply> {
    signal.throwIfAborted();
    try {
      const {content} = await this.auth.callFunction<{content:string}>('ai-chat',{
        input:request.input,scope:request.scope,history:request.history,trip:request.trip,
      }, signal);
      signal.throwIfAborted();
      return normalizeChatResponse(content);
    } catch (error) {
      if (signal.aborted) throw error;
      const code = error instanceof Error ? error.message : '';
      const messages: Record<string,string> = {
        quota_exceeded:'AI 요청 한도에 도달했어요. 잠시 후 다시 시도해 주세요. 한도가 계속되면 공급자 사용량을 확인해 주세요.',
        authentication_required:'로그인이 필요해요. 다시 로그인해 주세요.',
        invalid_request:'질문이나 여행 문맥이 너무 길어요. 짧게 나누어 다시 질문해 주세요.',
        model_timeout:'응답이 오래 걸립니다. 잠시 후 다시 시도해 주세요.',
        server_unavailable:'AI 서버에 연결하지 못했어요. 서버 설정을 확인해 주세요.',
      };
      throw new Error(messages[code] ?? 'AI 답변을 받지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  }
}
