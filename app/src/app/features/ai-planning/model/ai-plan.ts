import type { VerifiedItem } from '../util/verify-places';

/** 3단계 입력 → 조건 요약 → 생성 중 → 결과 선택. */
export type Phase = 'step1' | 'step2' | 'step3' | 'summary' | 'generating' | 'result';

/**
 * 결과 목록의 한 줄. 이름과 일차는 모델이 내고, 좌표·주소·분류는 장소 검색으로
 * 확인한 값이다. 모델이 쓴 설명은 사실과 다를 때가 많아 쓰지 않는다.
 */
export type PlanItem = VerifiedItem;

export const COMPANION = ['혼자', '친구', '연인', '가족'] as const;
export const PACE = ['여유롭게', '보통', '알차게'] as const;
export const TRANSPORT = ['자가용', '대중교통', '도보 중심'] as const;

export interface AiPlanSelection {
  readonly requestId: string;
  readonly regions: string[];
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly items: readonly PlanItem[];
}

/** 생성이 실패한 이유. 화면 문구를 고르는 데 쓴다. */
export type GenerateError =
  | { kind: 'offline'; message: string }
  | { kind: 'timeout'; message: string }
  | { kind: 'quota'; message: string }
  | { kind: 'empty'; message: string }
  | { kind: 'other'; message: string };
