import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PageBar } from '../../../../core/page-bar';
import { ToastService } from '../../../../core/toast-service';
import { UiNotice } from '../../../../shared/ui/notice/notice';
import { UiSpinner } from '../../../../shared/ui/spinner/spinner';
import { SUPPORT_REPOSITORY } from '../../data/support-repository';
import type { Notice } from '../../model/support';
import { supportDay } from '../../util/support-date';

/**
 * 공지 상세. 목록에서 두 줄만 보이던 본문을 전부 읽는다.
 * 지워졌거나 아직 발행되지 않은 공지면 알리고 목록으로 돌아간다.
 */
@Component({
  selector: 'app-notice-detail',
  imports: [UiNotice, UiSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notice-detail.html',
})
export class NoticeDetailPage {
  private readonly support = inject(SUPPORT_REPOSITORY);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** 라우트의 :id */
  readonly id = input<string>('');
  readonly notice = signal<Notice | null>(null);
  readonly error = signal<string | null>(null);
  readonly day = supportDay;

  constructor() {
    inject(PageBar).set({ title: '공지사항', back: ['/account/notices'], action: null });
    effect(() => {
      const id = this.id();
      if (id) void this.load(id);
    });
  }

  private async load(id: string): Promise<void> {
    try {
      const found = (await this.support.notices()).find((n) => n.id === id) ?? null;
      if (!found) {
        this.toast.error('이미 지워진 공지예요.');
        await this.router.navigateByUrl('/account/notices', { replaceUrl: true });
        return;
      }
      this.notice.set(found);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : '공지사항을 불러오지 못했어요.');
    }
  }
}
