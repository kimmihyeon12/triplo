import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { PageBar } from '../../../../core/page-bar';
import { TripEditorStore } from '../../../trips/data/trip-editor-store';
import { createRegion, createTrip } from '../../../trips/util/factories';
import type { Trip } from '../../../trips/model/trip';
import { UiButton } from '../../../../shared/ui/button/button';
import { ChatThread } from '../../ui/chat-thread/chat-thread';
import { CompanionFace } from '../../ui/companion-face/companion-face';
import { TravelChatStore } from '../../data/travel-chat-store';
import type { ChatDraft } from '../../model/chat';

/**
 * 여행 목록에서 연 대화. 아직 대상 여행이 없으므로 전체 화면으로 연다.
 *
 * 대화 중에는 빈 여행을 임시로 들고 있다가, 사용자가 확인 카드에서 담으면
 * 그때 실제로 저장한다. 담기 전에는 아무것도 만들지 않으므로 대화만 하다
 * 나가도 빈 여행이 목록에 쌓이지 않는다.
 */
@Component({
  selector: 'app-chat-page',
  templateUrl: './chat.html',
  imports: [ChatThread, UiButton, CompanionFace],
  providers: [TravelChatStore, TripEditorStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  /*
    대화는 화면을 가득 채워야 입력창이 아래에 붙는다. main에는 높이가 지정되어
    있지 않아 flex-1로 늘어날 부모가 없으므로, 상단 바(53px)를 뺀 높이를 여기서
    직접 잡는다. dvh를 쓰는 이유는 모바일 주소창이 접힐 때 100vh가 화면보다
    커져 입력창이 아래로 잘리기 때문이다.
  */
  host: { class: 'flex h-[calc(100dvh-53px)] flex-col' },
})
export class ChatPage implements OnInit {
  readonly store = inject(TravelChatStore);
  private readonly editor = inject(TripEditorStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** 이미 반영한 말풍선. 그 카드에는 되돌리기만 남긴다. */
  readonly appliedMessageId = signal<string | null>(null);
  /** 사용자가 그대로 두기를 고른 초안. 카드를 접는다. */
  readonly dismissedIds = signal<readonly string[]>([]);
  /** 담아서 만들어진 여행. 나가기 전까지 여기에 쌓인다. */
  readonly savedTripId = signal<string | null>(null);

  constructor() {
    inject(PageBar).set({ title: 'AI 채팅', back: ['/trips'], action: null });
  }

  ngOnInit(): void {
    this.store.open('list', null);
  }

  send(text: string): void {
    void this.store.send(text);
  }

  /**
   * 확인 카드에서 담기를 누르면 그때 여행을 만든다.
   *
   * 아직 여행이 없으므로 초안의 지역으로 빈 여행을 먼저 세우고 거기에 담는다.
   * 이미 담아 만든 여행이 있으면 그 여행에 이어 붙인다. 대화 한 번에 여행이
   * 여러 개 생기면 사용자가 어디에 담겼는지 알 수 없다.
   */
  async apply(event: { messageId: string; draft: ChatDraft }): Promise<void> {
    if (this.editor.saveState() === 'saving') return;
    if (!this.store.trip()) this.store.setTrip(this.blankTrip(event.draft));
    const next = this.store.applyDraft(event.draft);
    if (!next) return;
    if (!(await this.editor.commit(next)) || this.destroyRef.destroyed) return;
    this.appliedMessageId.set(event.messageId);
    this.savedTripId.set(next.id);
  }

  async undo(): Promise<void> {
    const previous = this.store.undo();
    if (!previous) return;
    await this.editor.commit(previous);
    this.appliedMessageId.set(null);
  }

  dismissDraft(messageId: string): void {
    this.dismissedIds.set([...this.dismissedIds(), messageId]);
  }

  /** 담은 여행을 보러 간다. 대화 화면은 히스토리에서 치운다. */
  goToTrip(): void {
    const id = this.savedTripId();
    if (id) void this.router.navigate(['/trips', id], { replaceUrl: true });
  }

  /** 초안이 가리키는 지역으로 빈 여행을 세운다. 날짜는 아직 정하지 않는다. */
  private blankTrip(draft: ChatDraft): Trip {
    const names = draft.action === 'append' ? draft.regions : [];
    return createTrip({
      title: names.length ? `${names.join('·')} 여행` : '새 여행',
      regions: names.map((name, i) => createRegion(name, i)),
    });
  }
}
