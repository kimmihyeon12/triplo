import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PageBar } from '../../../../core/page-bar';
import { UiBadge } from '../../../../shared/ui/badge/badge';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiInput } from '../../../../shared/ui/input/input';
import { UiNotice } from '../../../../shared/ui/notice/notice';
import { UiSpinner } from '../../../../shared/ui/spinner/spinner';
import type { BadgeTone } from '../../../../shared/util/badge-tone';
import { INQUIRY_KIND_LABEL, INQUIRY_STATUS_LABEL, type InquiryStatus } from '../../../support/model/support';
import { AdminSupport, isAdminDenied } from '../../data/admin-support';
import { REPLY_BODY_MAX, type AdminInquiry } from '../../model/admin-support';
import { replyFormError } from '../../util/admin-form';

/**
 * 관리자 문의 상세. 본문과 기기 정보를 보고 답한다. 답하면 서버가 답변 완료로 바꾸고
 * 사용자에게 새 답변으로 보인다. 확인 중 표시는 관리자가 직접 바꾼다.
 */
@Component({
  selector: 'app-admin-inquiry',
  imports: [UiBadge, UiButton, UiInput, UiNotice, UiSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-inquiry.html',
})
export class AdminInquiryPage {
  private readonly support = inject(AdminSupport);
  private readonly router = inject(Router);

  readonly id = input<string>('');
  readonly kindLabel = INQUIRY_KIND_LABEL;
  readonly statusLabel = INQUIRY_STATUS_LABEL;
  readonly replyMax = REPLY_BODY_MAX;

  readonly inquiry = signal<AdminInquiry | null>(null);
  readonly reply = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly replyError = computed(() => replyFormError(this.reply()));

  constructor() {
    inject(PageBar).set({ title: '문의', back: ['/admin/inquiries'], action: null });
    effect(() => {
      const id = this.id();
      if (id) void this.load(id);
    });
  }

  private async load(id: string): Promise<void> {
    await this.run(async () => {
      const found = await this.support.inquiry(id);
      if (!found) {
        await this.router.navigateByUrl('/admin/inquiries', { replaceUrl: true });
        return;
      }
      this.inquiry.set(found);
    });
  }

  async send(event: Event): Promise<void> {
    event.preventDefault();
    if (this.replyError() || this.busy()) return;
    await this.run(async () => {
      await this.support.reply(this.id(), this.reply());
      this.reply.set('');
      this.inquiry.set(await this.support.inquiry(this.id()));
    });
  }

  async setStatus(status: InquiryStatus): Promise<void> {
    if (this.busy()) return;
    await this.run(async () => {
      await this.support.setStatus(this.id(), status);
      this.inquiry.set(await this.support.inquiry(this.id()));
    });
  }

  tone(status: InquiryStatus): BadgeTone {
    return status === 'answered' ? 'ok' : status === 'open' ? 'warn' : 'neutral';
  }

  time(iso: string): string {
    return new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  /** 호출 하나를 감싼다. 권한이 사라지면 내 정보로, 그 밖의 오류는 화면에 보인다. 입력은 남긴다. */
  private async run(work: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await work();
    } catch (error) {
      if (isAdminDenied(error)) {
        await this.router.navigateByUrl('/account', { replaceUrl: true });
        return;
      }
      this.error.set(error instanceof Error ? error.message : '처리하지 못했어요. 다시 시도해 주세요.');
    } finally {
      this.busy.set(false);
    }
  }
}
