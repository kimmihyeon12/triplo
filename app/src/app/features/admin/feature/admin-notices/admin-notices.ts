import { supportDay } from '../../../support/util/support-date';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageBar } from '../../../../core/page-bar';
import { UiBadge } from '../../../../shared/ui/badge/badge';
import { UiEmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { UiNotice } from '../../../../shared/ui/notice/notice';
import { UiSpinner } from '../../../../shared/ui/spinner/spinner';
import type { Notice } from '../../../support/model/support';
import { AdminSupport, isAdminDenied } from '../../data/admin-support';
import { adminExit } from '../admin-exit';

/**
 * 관리자 공지 목록. 초안과 발행된 공지를 함께 보이고, 누르면 고치는 화면으로 간다.
 * 권한이 사라져 서버가 거절하면 내 정보로 보낸다.
 */
@Component({
  selector: 'app-admin-notices',
  imports: [RouterLink, UiBadge, IconComponent, UiEmptyState, UiNotice, UiSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-notices.html',
})
export class AdminNotices {
  private readonly support = inject(AdminSupport);
  private readonly exit = adminExit();
  readonly notices = signal<Notice[] | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    // 새 공지는 앱의 다른 목록처럼 상단 바 오른쪽 동작으로 둔다. 본문에 큰 버튼을 두지 않는다.
    inject(PageBar).set({
      title: '공지 관리',
      back: ['/admin'],
      action: { label: '새 공지', icon: 'plus', link: ['/admin/notices/new'], testId: 'admin-notice-new' },
    });
    void this.load();
  }

  async load(): Promise<void> {
    try {
      this.notices.set(await this.support.notices());
      this.error.set(null);
    } catch (error) {
      if (isAdminDenied(error)) {
        void this.exit.denied();
        return;
      }
      this.error.set(error instanceof Error ? error.message : '공지를 불러오지 못했어요.');
    }
  }

  day(notice: Notice): string {
    return supportDay(notice.publishedAt ?? notice.createdAt);
  }
}
