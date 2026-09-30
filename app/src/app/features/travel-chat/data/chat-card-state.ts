import { signal } from '@angular/core';

/**
 * 한 대화 화면의 확인 카드 표시 상태: 방금 담은 카드와 사용자가 닫은 카드.
 *
 * 전체 채팅과 채팅 시트가 같은 신호·갱신·초기화를 따로 들고 있었다(리팩터링 제안 C7).
 * 화면마다 새로 만들어 쓰므로 두 화면의 상태는 섞이지 않는다. 담기·되돌리기의 저장
 * 흐름은 화면마다 성공 확정 시점이 달라 여기로 옮기지 않는다.
 */
export class ChatCardState {
  private readonly applied = signal<string | null>(null);
  private readonly dismissed = signal<readonly string[]>([]);

  /** 담기에 성공한 카드. '담았어요'와 되돌리기를 보인다. */
  readonly appliedMessageId = this.applied.asReadonly();
  /** 사용자가 그대로 두기로 닫은 카드. */
  readonly dismissedIds = this.dismissed.asReadonly();

  markApplied(messageId: string): void {
    this.applied.set(messageId);
  }

  clearApplied(): void {
    this.applied.set(null);
  }

  dismiss(messageId: string): void {
    this.dismissed.update((ids) => [...ids, messageId]);
  }

  /** 새 대화를 시작할 때 비운다. */
  reset(): void {
    this.applied.set(null);
    this.dismissed.set([]);
  }
}
