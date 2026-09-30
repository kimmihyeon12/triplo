import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageBar } from '../../../../core/page-bar';
import { UiBadge } from '../../../../shared/ui/badge/badge';
import { UiButton } from '../../../../shared/ui/button/button';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { UiNotice } from '../../../../shared/ui/notice/notice';
import { UiSpinner } from '../../../../shared/ui/spinner/spinner';
import { formatKoreanDate } from '../../../../shared/util/dates';
import type { Notice } from '../../../support/model/support';
import { AdminSupport, isAdminDenied } from '../../data/admin-support';
import { adminExit } from '../admin-exit';

/**
 * 관리자 공지 목록. 초안과 발행된 공지를 함께 보이고, 누르면 고치는 화면으로 간다.
 * 권한이 사라져 서버가 거절하면 내 정보로 보낸다.
 */
@Component({
  selector: 'app-admin-notices',
  imports: [RouterLink, UiBadge, UiButton, IconComponent, UiNotice, UiSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-notices.html',
})
export class AdminNotices {
  private readonly support = inject(AdminSupport);
  private readonly exit = adminExit();
  readonly notices = signal<Notice[] | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    inject(PageBar).set({ title: '공지 관리', back: ['/admin'], action: null });
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
    const iso = notice.publishedAt ?? notice.createdAt;
    return formatKoreanDate(iso.slice(0, 10), { short: true });
  }
}
