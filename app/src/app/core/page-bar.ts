import { Injectable, signal } from '@angular/core';
import type { IconName } from '../shared/ui/icon/icon';

/**
 * 상단 바 한 줄(`‹ 제목 [동작]`)의 내용을 화면이 지정한다.
 * 모바일 앱 관례대로 화면 제목은 본문 h1이 아니라 상단 바에 둔다.
 */
export interface PageBarAction {
  /** 오른쪽 동작 라벨(텍스트 버튼) */
  readonly label: string;
  /**
   * 라우터 링크. 다른 화면으로 가는 동작에 쓴다.
   *
   * 이것도 `run`도 없으면 그려지지 않는다. 전에는 `link` 없이 넣으면
   * 빈 링크가 그려져 눌러도 아무 일이 없었다.
   */
  readonly link?: unknown[];
  readonly queryParams?: Record<string, unknown>;
  /**
   * 화면을 떠나지 않고 그 자리에서 처리하는 동작(대화 초기화 등).
   * `link`와 함께 쓰지 않는다.
   */
  readonly run?: () => void;
  /** `run` 동작이 처리 중이라 누를 수 없을 때 true. */
  readonly disabled?: boolean;
  /** 아이콘 이름(app-icon). 라벨만 쓸 경우 생략 */
  readonly icon?: IconName;
  /** 지정하면 라벨 대신 이 글자를 담은 원형 아바타로 그린다(닉네임 첫 글자 등). */
  readonly avatar?: string;
  /** 링크 없이 화면이 직접 처리하는 메뉴 항목의 식별자(예: 삭제). */
  readonly action?: string;
  /** 파괴적 동작이면 true. 메뉴에서 로즈 계열로 그린다. */
  readonly danger?: boolean;
  readonly testId?: string;
  readonly ariaLabel?: string;
}

export interface PageBarState {
  /** Optional compact people/tools area; supplied by the owning screen. */
  readonly tools?: {
    people: { id: string; name: string }[];
    inviteLink: unknown[];
    menu: PageBarAction[];
    /** 링크 없는 메뉴 항목을 화면이 받아 처리한다. */
    onAction?: (action: string) => void;
  };
  /** 뒤로가기가 있으면 왼쪽 정렬. 비우면 제목 없이 심볼만 보인다. */
  readonly title: string;
  /** 왼쪽 뒤로 가기 링크. null이면 T 심볼(홈)을 표시한다. */
  readonly back: unknown[] | null;
  readonly backQueryParams?: Record<string, unknown>;
  readonly action?: PageBarAction | null;
  /** 로그인처럼 상단 바가 필요 없는 첫 화면에서 쓴다. */
  readonly hidden?: boolean;
}

const EMPTY: PageBarState = { title: '', back: null, action: null };

@Injectable({ providedIn: 'root' })
export class PageBar {
  private readonly value = signal<PageBarState>(EMPTY);
  readonly state = this.value.asReadonly();

  set(next: PageBarState): void {
    this.value.set(next);
  }

  reset(): void {
    this.value.set(EMPTY);
  }
}
