import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageBar } from '../../../../core/page-bar';
import { UiEmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { IconComponent, type IconName } from '../../../../shared/ui/icon/icon';
import { UiNotice } from '../../../../shared/ui/notice/notice';
import { UiSpinner } from '../../../../shared/ui/spinner/spinner';
import { NOTIFICATION_INBOX } from '../../data/notification-inbox-token';
import { inboxTime, safeInboxUrl, type InboxItem, type InboxKind } from '../../model/inbox';

/** 종류마다 줄 앞 아이콘. 글자(제목)가 뜻을 말하므로 아이콘만으로 구분하지 않는다. */
const INBOX_ICON: Readonly<Record<InboxKind, IconName>> = {
  reply: 'mail',
  notice: 'megaphone',
  join: 'users',
  trip: 'calendar',
  ledger: 'wallet',
};

/**
 * 알림 내역(2026-10-06). 푸시를 켜지 않았어도 지난 알림을 최근 것부터 본다.
 * 줄을 누르면 그 알림이 가리키는 화면으로 간다. 화면을 열면 모두 읽은 것으로 한다
 * (공지사항과 같은 규칙: 이번 화면에서만 새 표시를 남기고 다음에 열면 사라진다).
 */
@Component({
  selector: 'app-notification-inbox',
  imports: [RouterLink, IconComponent, UiSpinner, UiEmptyState, UiNotice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-inbox.html',
})
export class NotificationInboxPage {
  private readonly inbox = inject(NOTIFICATION_INBOX);

  readonly items = signal<InboxItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly icon = INBOX_ICON;
  readonly time = inboxTime;
  readonly link = safeInboxUrl;

  constructor() {
    inject(PageBar).set({ title: '알림 내역', back: ['/account'], action: null });
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.items.set(await this.inbox.list());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : '알림 내역을 불러오지 못했어요.');
      return;
    } finally {
      this.loading.set(false);
    }
    // 실패해도 목록은 이미 보였다. 다음에 열 때 다시 센다.
    await this.inbox.markAllRead().catch(() => undefined);
  }
}
