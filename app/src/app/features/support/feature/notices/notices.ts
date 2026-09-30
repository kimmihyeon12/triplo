import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { PageBar } from '../../../../core/page-bar';
import { SUPPORT_REPOSITORY } from '../../data/support-repository';
import type { Notice } from '../../model/support';
import { UiEmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { UiSpinner } from '../../../../shared/ui/spinner/spinner';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { UiNotice } from '../../../../shared/ui/notice/notice';

/**
 * 공지사항 목록.
 *
 * 화면을 옮기지 않고 그 자리에서 펼쳐 읽는다. 공지는 대개 짧아 별도 화면을
 * 열 만큼이 아니고, 여러 개를 이어 읽을 때 돌아오는 수고가 없다.
 */
@Component({
  selector: 'app-notices',
  imports: [UiSpinner, IconComponent, UiEmptyState, UiNotice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notices.html',
})
export class NoticesPage {
  private readonly support = inject(SUPPORT_REPOSITORY);

  readonly notices = signal<Notice[]>([]);
  readonly loading = signal(true);
  /** 불러오지 못한 이유. 서버 저장이라 네트워크가 끊기면 실패한다. */
  readonly error = signal<string | null>(null);

  /** 이 화면에 들어오기 전 읽지 않았던 공지 id. 새 소식 표시에 쓴다. */
  readonly unreadIds = signal<Set<string>>(new Set());

  constructor() {
    inject(PageBar).set({ title: '공지사항', back: ['/account'], action: null });
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const [list, unread] = await Promise.all([
        this.support.notices(),
        this.support.unreadNoticeIds(),
      ]);
      this.unreadIds.set(new Set(unread));
      this.notices.set(list);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : '공지사항을 불러오지 못했어요.');
      return;
    } finally {
      this.loading.set(false);
    }
    // 화면에 들어온 시점에 읽은 것으로 본다. 목록을 열었으면 본 것이다.
    // 표시는 이번 화면에서만 남고 다음에 열면 사라진다. 실패하면 다음에 다시 센다.
    await this.support.markNoticesRead().catch(() => undefined);
  }

  /** 'YYYY.MM.DD' 형식. 공지는 시각까지 필요하지 않다. */
  day(iso: string): string {
    const d = new Date(iso);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}.${mm}.${dd}`;
  }
}
