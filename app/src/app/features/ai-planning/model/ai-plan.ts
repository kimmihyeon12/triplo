import type { PlanEstimate } from '../../../shared/model/plan-estimate';
import type { GeoPoint, PlaceRef } from '../../places/model/place';
import type { PlanKind } from '../../trips/model/trip';

export type MoveMode = '도보' | '대중교통' | '자가용' | '택시';

/** 다음 장소까지의 이동. 모델 추정이며 화면에만 보이고 저장하지 않는다. */
export interface AiMove {
  readonly mode: MoveMode;
  readonly minutes: number;
}

/**
 * 정기휴무 정보. 모델이 아는 영업정보라 AI 추정이며, 화면에서 확인 링크와 함께 보이고
 * 일정 필드에는 저장하지 않는다. onDay는 그 일차 날짜가 휴무일에 걸리는지다.
 */
export interface ClosedInfo {
  readonly onDay: boolean;
  readonly note: string;
}

/** 3단계 입력 → 조건 요약 → 생성 중 → 결과 선택. */
export type Phase = 'step1' | 'step2' | 'step3' | 'summary' | 'generating' | 'result';

/**
 * 결과 목록의 한 줄. 이름과 일차는 모델이 내고, 좌표·주소·분류는 장소 검색으로
 * 확인한 값이다. 모델의 예상 비용·체류시간은 별도 추정 정보로 유지한다.
 */
export interface VerifiedItem {
  readonly estimate?: PlanEstimate;
  readonly id: string;
  readonly day: number;
  readonly name: string;
  readonly kind: PlanKind;
  /** 그날 안의 방문 순서(1부터). 모델이 짠 순서다. */
  readonly order: number;
  /** 추천 도착 시각. AI 추정이며 일정의 고정 시각으로 저장하지 않는다. */
  readonly start: string | null;
  /** 다음 항목까지의 이동. AI 추정이며 화면에만 보이고 저장하지 않는다. */
  readonly moveToNext: AiMove | null;
  /** AI 추정 휴무 정보. 없으면 모름이다. */
  readonly closed?: ClosedInfo | null;
  /** 검색으로 실재를 확인했는지. 확인한 항목만 기본 선택 대상이다. */
  readonly verified: boolean;
  /** 검색 결과의 분류. 모델이 지어낸 설명을 쓰지 않는다. */
  readonly note: string;
  readonly address: string;
  readonly location: GeoPoint | null;
  readonly placeRef: PlaceRef | null;
}

export type PlanItem = VerifiedItem;

export const COMPANION = ['혼자', '친구', '연인', '가족'] as const;
export const PACE = ['여유롭게', '보통', '알차게'] as const;
export const TRANSPORT = ['자가용', '대중교통', '도보 중심'] as const;

export interface AiPlanSelection {
  readonly partySize?: number;
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
