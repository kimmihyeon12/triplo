import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiInput } from '../../../../shared/ui/input/input';
import { UiNotice } from '../../../../shared/ui/notice/notice';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { AiDisclaimer } from '../ai-disclaimer/ai-disclaimer';
import { CompanionFace, type CompanionMood } from '../companion-face/companion-face';
import { ChatConfirmCard } from '../chat-confirm-card/chat-confirm-card';
import type { ChatDraft, ChatError, ChatMessage } from '../../model/chat';
import { previewDraft, type DraftPreview } from '../../util/chat-draft';
import type { Trip } from '../../../trips/model/trip';

/** 대상 여행이 아직 없을 때 미리보기의 기준이 되는 빈 여행. */
const EMPTY_TRIP: Trip = {
  id: '',
  title: '',
  startDate: null,
  endDate: null,
  regions: [],
  stops: [],
  stays: [],
  status: 'draft',
  createdAt: '',
  updatedAt: '',
  schemaVersion: 1,
};

/**
 * 대화 말풍선·추천 칩·입력창을 그리는 화면 조각.
 *
 * 전체 화면과 하단 시트가 같은 것을 쓴다. 두 곳의 대화가 서로 다르게 보이면
 * 사용자가 같은 기능임을 알아채기 어렵다. 바깥 틀만 다르게 두고 안쪽은
 * 이 컴포넌트 하나로 맞춘다.
 */
@Component({
  selector: 'app-chat-thread',
  templateUrl: './chat-thread.html',
  styleUrl: './chat-thread.css',
  imports: [UiButton, UiInput, UiNotice, IconComponent, AiDisclaimer, ChatConfirmCard, CompanionFace],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class ChatThread {
  readonly messages = input.required<readonly ChatMessage[]>();
  readonly chips = input.required<readonly string[]>();
  readonly pending = input(false);
  readonly error = input<ChatError | null>(null);
  readonly trip = input<Trip | null>(null);
  /** 이미 반영한 초안의 말풍선 id. 되돌리기 버튼만 남긴다. */
  readonly appliedMessageId = input<string | null>(null);
  /** 사용자가 '그대로 두기'를 고른 말풍선 id. 그 카드는 접는다. */
  readonly dismissedIds = input<readonly string[]>([]);
  /** 남은 호출 횟수. 0이면 새 대화를 권한다. */
  readonly turnsLeft = input(0);

  readonly send = output<string>();
  readonly apply = output<{ messageId: string; draft: ChatDraft }>();
  readonly dismissDraft = output<string>();
  readonly undo = output<void>();
  readonly cancel = output<void>();

  readonly draftText = signal('');

  /** 빈 화면의 안내. 어디서 열었는지에 따라 할 수 있는 일이 다르다. */
  readonly emptyTitle = computed(() =>
    this.trip() ? '일정을 어떻게 고칠까요' : '어디로 갈지 함께 찾아요',
  );
  readonly emptyHint = computed(() =>
    this.trip()
      ? '장소를 더하거나 빼고 순서를 정리할 수 있어요. 바꾸기 전에 무엇이 달라지는지 보여드려요.'
      : '아직 정하지 못했어도 괜찮아요. 며칠 쉬는지, 누구와 가는지만 알려 주세요.',
  );

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  constructor() {
    // 새 말이 오면 맨 아래로 따라간다. 답이 길면 첫 줄만 보이고 멈춰
    // 사용자가 매번 내려야 한다.
    effect(() => {
      this.messages();
      this.pending();
      const element = this.scroller()?.nativeElement;
      if (!element) return;
      // 레이아웃이 자리를 잡은 다음에 재야 실제 높이가 나온다.
      requestAnimationFrame(() => element.scrollTo({ top: element.scrollHeight }));
    });
  }

  /**
   * 확인 카드에 보여줄 전후 비교. 사용자가 그대로 두기를 골랐으면 만들지 않는다.
   *
   * 여행 목록에서 연 대화는 담기 전까지 대상 여행이 없다. 그때는 빈 여행을
   * 기준으로 만들어 '무엇이 담기는지'를 보여준다. 담기를 누르는 순간 실제
   * 여행이 만들어지므로, 그전에 여행을 세워 두면 대화만 하다 나간 사람에게
   * 빈 여행이 남는다.
   */
  preview(messageId: string, draft: ChatDraft): DraftPreview | null {
    if (this.dismissedIds().includes(messageId)) return null;
    return previewDraft(this.trip() ?? EMPTY_TRIP, draft);
  }

  /** 대화에는 승인된 작은 미소를 쓴다. 졸림은 진입 버튼 전용이다. */
  moodOf(message: ChatMessage): CompanionMood {
    if (message.draft) return 'found';
    return 'talking';
  }

  submit(): void {
    const text = this.draftText().trim();
    if (!text || this.pending()) return;
    this.send.emit(text);
    this.draftText.set('');
  }

  /** 칩을 누르면 그 말을 그대로 보낸다. 입력창에 넣고 다시 누르게 하지 않는다. */
  pickChip(chip: string): void {
    if (this.pending()) return;
    this.send.emit(chip);
  }

  onInput(event: Event): void {
    this.draftText.set((event.target as HTMLTextAreaElement).value);
  }

  /**
   * 엔터로 보낸다. 줄바꿈은 Shift와 함께 누른다. 대화는 대개 한 줄이라
   * 매번 버튼으로 손을 옮기면 느리다.
   */
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) return;
    // 한글 입력 중의 엔터는 글자를 확정하는 것이라 보내면 안 된다.
    if (event.isComposing) return;
    event.preventDefault();
    this.submit();
  }
}
