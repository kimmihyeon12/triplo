import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { UiButton } from '../../../../shared/ui/button/button';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { ChatThread } from '../../ui/chat-thread/chat-thread';
import { TravelChatStore } from '../../data/travel-chat-store';
import type { ChatDraft } from '../../model/chat';
import type { Trip } from '../../../trips/model/trip';

/**
 * 여행 상세에서 여는 대화. 하단 시트로 연다.
 *
 * 전체 화면으로 덮지 않는 이유는 고치는 대상이 보여야 하기 때문이다. 변경
 * 내용을 확인하러 매번 시트를 닫으면 대화가 끊긴다. 처음에는 화면 절반쯤
 * 올라오고, 필요하면 위로 끌어 전체로 넓힌다.
 */
@Component({
  selector: 'app-chat-sheet',
  templateUrl: './chat-sheet.html',
  imports: [ChatThread, UiButton, IconComponent],
  providers: [TravelChatStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatSheet {
  readonly trip = input.required<Trip>();
  readonly open = input(false);

  readonly close = output<void>();
  /** 반영한 여행. 상세 화면이 받아 저장한다. */
  readonly applied = output<Trip>();

  readonly store = inject(TravelChatStore);

  /** 시트를 전체 높이로 올렸는지. 처음에는 절반이다. */
  readonly expanded = signal(false);
  readonly appliedMessageId = signal<string | null>(null);
  readonly dismissedIds = signal<readonly string[]>([]);

  /**
   * 시트 높이. 절반일 때 화면의 62%를 쓴다. 정확히 절반으로 두면 말풍선
   * 두어 개와 입력창만 들어가 대화를 이어 가기 어렵다.
   */
  readonly heightClass = computed(() => (this.expanded() ? 'h-[92dvh]' : 'h-[62dvh]'));

  constructor() {
    effect(() => {
      const trip = this.trip();
      if (this.open()) this.store.open('trip', trip);
      else this.store.setTrip(trip);
    });
  }

  send(text: string): void {
    void this.store.send(text);
  }

  /** 확인한 변경을 반영한다. 저장은 여행 상세가 한다. */
  apply(event: { messageId: string; draft: ChatDraft }): void {
    const next = this.store.applyDraft(event.draft);
    if (!next) return;
    this.appliedMessageId.set(event.messageId);
    this.applied.emit(next);
  }

  undo(): void {
    const previous = this.store.undo();
    if (!previous) return;
    this.appliedMessageId.set(null);
    this.applied.emit(previous);
  }

  dismissDraft(messageId: string): void {
    this.dismissedIds.set([...this.dismissedIds(), messageId]);
  }

  /** 배경을 누르면 닫는다. 시트 안쪽 클릭은 올라오지 않게 막는다. */
  onBackdrop(): void {
    this.close.emit();
  }

  toggleExpand(): void {
    this.expanded.update((value) => !value);
  }
}
