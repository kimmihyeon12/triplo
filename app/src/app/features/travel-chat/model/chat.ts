import type { StopKind } from '../../trips/model/trip';
import type { VerifiedItem } from '../../ai-planning/model/ai-plan';

/**
 * 대화형 여행 탐색의 도메인 타입. 화면·저장소·제공자가 함께 쓴다.
 *
 * 모델이 돌려주는 것은 여기까지다. 좌표·주소·분류는 장소 검색으로 대조한
 * 뒤에만 채우며, 모델이 만든 값을 그대로 일정에 저장하지 않는다.
 */

/** 대화를 어디서 열었는지. 추천 칩과 담기 동작이 이 값에 따라 달라진다. */
export type ChatScope = 'list' | 'trip';

/** 말한 사람. 'system'은 앱이 내는 안내로, 호출 횟수에 들어가지 않는다. */
export type ChatRole = 'user' | 'assistant' | 'system';

/**
 * 모델 응답의 갈래. 기획안 35절의 질문 종류별 처리를 그대로 옮긴 것이며,
 * 화면은 이 값으로 말풍선의 생김새를 고른다.
 *
 * 'reference'는 영업시간·요금처럼 확인되지 않은 정보라서 구분 표시와 확인
 * 링크를 함께 보여준다. 'refusal'은 여행과 무관한 질문에 대한 정해진 안내다.
 */
export type ChatReplyKind = 'explore' | 'draft' | 'reference' | 'outside' | 'refusal';

/** 참고 정보를 확인할 수 있는 바깥 링크. 네이버·카카오를 함께 준다. */
export interface ReferenceLink {
  readonly label: string;
  readonly url: string;
}

/**
 * 확인되지 않은 참고 정보. 모델이 답하되 확인된 사실과 구분해 보여준다.
 * 이 값은 대화에만 쓰고 일정에 저장하지 않는다.
 */
export interface ReferenceNote {
  /** 무엇에 대한 정보인지. 예: '불국사' */
  readonly subject: string;
  readonly body: string;
  readonly links: readonly ReferenceLink[];
}

/** 확인 카드가 제안하는 변경의 종류. 설계가 정한 네 가지만 허용한다. */
export type DraftAction = 'append' | 'remove' | 'move' | 'reschedule';

/**
 * 일정에 담을 후보 장소. 모델은 이름과 일차만 내고, 나머지는 장소 검색으로
 * 대조한 결과다. `verified`가 거짓이면 좌표가 없어 담을 수 없다.
 */
export type ChatPlace = VerifiedItem;

/** 새 여행 또는 기존 여행에 장소를 더하는 초안. */
export interface AppendDraft {
  readonly action: 'append';
  readonly regions: readonly string[];
  readonly places: readonly ChatPlace[];
}

/** 이미 담긴 장소를 빼는 초안. */
export interface RemoveDraft {
  readonly action: 'remove';
  readonly stopIds: readonly string[];
}

/** 하루 안에서 차례를 바꾸는 초안. 결과 순서를 통째로 넘긴다. */
export interface MoveDraft {
  readonly action: 'move';
  readonly date: string | null;
  /** 바꾼 뒤의 차례. 그날에 있는 장소를 모두 담는다. */
  readonly orderedStopIds: readonly string[];
}

/** 장소를 다른 날로 옮기는 초안. */
export interface RescheduleDraft {
  readonly action: 'reschedule';
  readonly stopId: string;
  readonly date: string | null;
}

export type ChatDraft = AppendDraft | RemoveDraft | MoveDraft | RescheduleDraft;

/** 대화 한 줄. 화면은 이 목록을 위에서 아래로 그린다. */
export interface ChatMessage {
  readonly id: string;
  readonly role: ChatRole;
  readonly kind: ChatReplyKind | null;
  readonly text: string;
  /** 참고 정보일 때만 채운다. */
  readonly reference: ReferenceNote | null;
  /** 확인 카드를 띄울 초안. 없으면 null이다. */
  readonly draft: ChatDraft | null;
  /** 이 말풍선 아래에 이어 보여줄 추천 칩. */
  readonly chips: readonly string[];
  readonly at: string;
}

/**
 * 모델 제공자가 돌려주는 응답. 대화 기록에 넣기 전 형태이며, 장소 이름은
 * 아직 대조하지 않은 상태다.
 */
export interface ChatReply {
  readonly kind: ChatReplyKind;
  readonly text: string;
  readonly reference: ReferenceNote | null;
  readonly chips: readonly string[];
  /**
   * 초안에 담을 장소 후보. 이름과 일차만 있고 좌표는 없다. store가 장소
   * 검색으로 대조한 뒤에 확인 카드를 만든다.
   */
  readonly places: readonly ChatPlaceSuggestion[];
  /** 모델이 제안한 지역. 새 여행을 만들 때 제목과 검색 범위에 쓴다. */
  readonly regions: readonly string[];
  /** 여행 안에서의 변경 제안. 여행 상세에서 연 대화만 쓴다. */
  readonly edit: ChatEditIntent | null;
}

/** 대조 전의 장소 후보. `AiItem`과 같은 모양이며 의도를 분명히 하려고 따로 둔다. */
export interface ChatPlaceSuggestion {
  readonly day: number;
  readonly name: string;
  readonly kind: StopKind;
}

/**
 * 이미 만든 일정을 고치라는 의도. 모델은 무엇을 하고 싶은지만 말하고,
 * 실제 대상 선택과 거리 계산은 앱이 저장된 값으로 한다.
 */
export type ChatEditIntent =
  | { readonly action: 'remove'; readonly names: readonly string[] }
  | { readonly action: 'move'; readonly date: string | null }
  | { readonly action: 'reschedule'; readonly name: string; readonly day: number };

/** 대화가 실패한 이유. 화면 문구를 고르는 데 쓴다. */
export type ChatError =
  | { readonly kind: 'offline'; readonly message: string }
  | { readonly kind: 'timeout'; readonly message: string }
  | { readonly kind: 'quota'; readonly message: string }
  | { readonly kind: 'empty'; readonly message: string }
  | { readonly kind: 'limit'; readonly message: string }
  | { readonly kind: 'other'; readonly message: string };

/**
 * 한 대화에서 모델을 부를 수 있는 횟수. 무료 한도를 앱 전체가 나눠 쓰므로
 * 한 사람이 몰아 쓰면 나머지가 못 쓴다.
 *
 * 화면 단계에서는 안내만 한다. 기기에서 세는 값은 개발자 도구로 지울 수
 * 있어 실제로 막지 못하며, 서버가 세는 일은 13-B에서 한다.
 */
export const CHAT_TURN_LIMIT = 20;

/** 여행과 무관한 질문에 돌려주는 정해진 안내. 거절로 끝내지 않는다. */
export const OUT_OF_SCOPE_REPLY =
  '저는 국내 여행 일정을 짜는 일만 도와드릴 수 있어요. 가고 싶은 지역이나 일정에 대해 물어봐 주세요.';
