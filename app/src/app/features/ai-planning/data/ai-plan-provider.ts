import { InjectionToken } from '@angular/core';
import type { AiItem } from '../util/ai-response';
import type { WireCandidate } from './place-candidates';

/**
 * 일정 초안을 만들어 주는 제공자. 화면은 이 인터페이스만 사용한다.
 * 실행 앱은 서버의 Edge Function을 부르고 테스트 앱은 픽스처를 사용한다.
 * 두 구현은 화면과 장소 검증 흐름을 공유한다.
 */

export interface AiPlanRequest {
  readonly partySize?: number;
  /** 여행 시작일. 모델이 요일별 휴무를 따지는 데 쓴다. 날짜 미정이면 없다. */
  readonly startDate?: string | null;
  readonly budget?: number | null;
  readonly budgetBasis?: 'person' | 'group';
  readonly regions: readonly string[];
  readonly dayCount: number;
  readonly companion: string;
  readonly transport: string;
  readonly pace: string;
  readonly taste: string;
  readonly mustGo: string;
  readonly bookedStay: string;
  readonly extraNote: string;
  /** 카카오 검색으로 모은 실제 장소 후보. 있으면 모델은 이 안에서 번호로만 고른다. */
  readonly candidates?: readonly WireCandidate[];
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
