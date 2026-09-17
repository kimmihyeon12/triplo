import { InjectionToken } from '@angular/core';
import type { AiItem } from '../util/ai-response';

/**
 * 일정 초안을 만들어 주는 제공자. 화면은 이 인터페이스만 사용한다.
 * 지금은 브라우저가 로컬 LLM을 직접 부르지만, 나중에 앱 서버를 두면
 * 서버를 부르는 구현으로 바꾸기만 하면 된다. 화면과 검증은 그대로 쓴다.
 */

export interface AiPlanRequest {
  readonly regions: readonly string[];
  readonly dayCount: number;
  readonly companion: string;
  readonly transport: string;
  readonly pace: string;
  readonly taste: string;
  readonly mustGo: string;
  readonly bookedStay: string;
  readonly extraNote: string;
}

export interface AiPlanAvailability {
  readonly available: boolean;
  /** 사용할 수 없는 이유. 화면에 그대로 보여준다. */
  readonly reason: string | null;
}

export interface AiPlanProvider {
  availability(): Promise<AiPlanAvailability>;
  /**
   * 조건에 맞는 장소 이름과 일차를 만든다. 좌표·주소·영업시간은 돌려주지 않는다.
   * 실재 확인과 상세 정보는 장소 검색으로 따로 대조한다.
   */
  generate(request: AiPlanRequest, signal: AbortSignal): Promise<readonly AiItem[]>;
}

export const AI_PLAN_PROVIDER = new InjectionToken<AiPlanProvider>('AI_PLAN_PROVIDER');
