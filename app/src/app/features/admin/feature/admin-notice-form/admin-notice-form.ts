import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PageBar } from '../../../../core/page-bar';
import { UiActionBar } from '../../../../shared/ui/action-bar/action-bar';
import { UiBadge } from '../../../../shared/ui/badge/badge';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiInput } from '../../../../shared/ui/input/input';
import { UiNotice } from '../../../../shared/ui/notice/notice';
import type { NoticeStatus } from '../../../support/model/support';
import { AdminSupport, isAdminDenied, isAdminMissing } from '../../data/admin-support';
import { NOTICE_BODY_MAX, NOTICE_TITLE_MAX } from '../../model/admin-support';
import { adminExit } from '../admin-exit';
import { noticeFormError } from '../../util/admin-form';

/**
 * 공지 작성·수정. 저장하면 초안으로 남고, 발행해야 사용자에게 보인다.
 * 삭제는 한 번 더 확인한다. 권한이 사라지면 내 정보로 보낸다.
 */
@Component({
  selector: 'app-admin-notice-form',
  imports: [UiActionBar, UiBadge, UiButton, UiInput, UiNotice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-notice-form.html',
})
export class AdminNoticeForm {
  private readonly support = inject(AdminSupport);
  private readonly router = inject(Router);
  private readonly exit = adminExit();

  /** 라우트의 :id. 새 공지면 없다. */
  readonly id = input<string | undefined>();
  readonly titleMax = NOTICE_TITLE_MAX;
  readonly bodyMax = NOTICE_BODY_MAX;

  readonly title = signal('');
  readonly body = signal('');
  /** 서버에 저장된 제목·본문. 다르면 발행을 잠근다(저장하지 않은 수정이 발행되는 줄 오해하지 않게). */
  private readonly savedTitle = signal('');
  private readonly savedBody = signal('');
  readonly dirty = computed(() => this.title() !== this.savedTitle() || this.body() !== this.savedBody());
  readonly status = signal<NoticeStatus>('draft');
  readonly busy = signal(false);
  readonly saved = signal(false);
  readonly confirmDelete = signal(false);
  readonly error = signal<string | null>(null);

  readonly formError = computed(() => noticeFormError(this.title(), this.body()));
  readonly isNew = computed(() => !this.id());

  constructor() {
    inject(PageBar).set({ title: '공지', back: ['/admin/notices'], action: null });
    effect(() => {
      const id = this.id();
      if (id) void this.load(id);
    });
  }

  private async load(id: string): Promise<void> {
    await this.run(async () => {
      const notice = await this.support.notice(id);
      if (!notice) {
        await this.exit.missing('이미 지워진 공지예요.', '/admin/notices');
        return;
      }
      this.title.set(notice.title);
      this.body.set(notice.body);
      this.savedTitle.set(notice.title);
      this.savedBody.set(notice.body);
      this.status.set(notice.status);
    });
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.formError() || this.busy()) return;
    await this.run(async () => {
      const id = await this.support.saveNotice(this.id() ?? null, this.title(), this.body());
      this.savedTitle.set(this.title());
      this.savedBody.set(this.body());
      this.saved.set(true);
      if (this.isNew()) await this.router.navigate(['/admin/notices', id], { replaceUrl: true });
    });
  }

  async togglePublished(): Promise<void> {
    const id = this.id();
    if (!id || this.busy()) return;
    await this.run(async () => {
      const publish = this.status() !== 'published';
      await this.support.setPublished(id, publish);
      this.status.set(publish ? 'published' : 'draft');
    });
  }

  async remove(): Promise<void> {
    const id = this.id();
    if (!id || this.busy()) return;
    if (!this.confirmDelete()) {
      this.confirmDelete.set(true);
      return;
    }
    await this.run(async () => {
      await this.support.deleteNotice(id);
      await this.router.navigateByUrl('/admin/notices', { replaceUrl: true });
    });
  }

  /** 호출 하나를 감싼다. 권한이 사라지면 내 정보로, 그 밖의 오류는 화면에 보인다. */
  private async run(work: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await work();
    } catch (error) {
      if (isAdminDenied(error)) {
        await this.exit.denied();
        return;
      }
      if (isAdminMissing(error)) {
        await this.exit.missing('이미 지워진 공지예요.', '/admin/notices');
        return;
      }
      this.error.set(error instanceof Error ? error.message : '저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      this.busy.set(false);
    }
  }
}
