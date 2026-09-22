import { InjectionToken } from '@angular/core';
import type { ChatReply, ChatScope } from '../model/chat';

/**
 * 대화 답변을 만들어 주는 제공자. 화면은 이 인터페이스만 쓴다.
 *
 * 지금은 고정 응답을 돌려주는 구현이 붙어 있고, 13-B에서 Supabase Edge
 * Function(`ai-chat`)을 부르는 구현으로 갈아 끼운다. 화면 코드는 그때
 * 고치지 않는다.
 *
 * `ai-plan`과 별개 함수로 두기로 한 결정에 맞춰 제공자도 따로 둔다. 지시문과
 * 응답 형식이 다르고, 한쪽 배포가 다른 쪽을 멈추게 하지 않아야 한다.
 */

/** 앞선 대화 한 줄. 모델에게 문맥으로 넘긴다. */
export interface ChatTurn {
  readonly role: 'user' | 'assistant';
  readonly text: string;
}

export interface ChatRequest {
  /** 이번에 사용자가 보낸 말. */
  readonly input: string;
  /** 어디서 연 대화인지. 답변의 성격과 담기 동작이 달라진다. */
  readonly scope: ChatScope;
  /** 지금까지의 대화. 같은 말을 반복하지 않게 하는 데 쓴다. */
  readonly history: readonly ChatTurn[];
  /**
   * 여행 상세에서 연 대화의 문맥. 어떤 장소가 어느 날에 있는지 알려 준다.
   * 좌표는 넘기지 않는다. 모델이 거리를 계산할 일이 없기 때문이다.
   */
  readonly trip: ChatTripContext | null;
}

/** 모델에게 넘기는 여행 요약. 저장된 값 그대로이며 모델이 고치지 않는다. */
export interface ChatTripContext {
  readonly title: string;
  readonly regions: readonly string[];
  readonly dayCount: number;
  /** 일차별 장소 이름. 모델이 '3일차 카페'를 가리킬 수 있게 한다. */
  readonly days: readonly { readonly day: number; readonly names: readonly string[] }[];
  readonly unassigned: readonly string[];
}

export interface ChatProvider {
  /** 쓸 수 있는 상태인지. 키가 없으면 이유를 화면에 그대로 보여준다. */
  availability(): Promise<{ readonly available: boolean; readonly reason: string | null }>;
  /**
   * 사용자의 말에 답한다. 장소 이름과 일차는 돌려주지만 좌표·주소는 돌려주지
   * 않는다. 실재 확인과 상세 정보는 장소 검색으로 따로 대조한다.
   */
  reply(request: ChatRequest, signal: AbortSignal): Promise<ChatReply>;
}

export const CHAT_PROVIDER = new InjectionToken<ChatProvider>('CHAT_PROVIDER');
