import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PageBar } from '../../../../core/page-bar';
import { SUPPORT_REPOSITORY } from '../../data/support-repository';
import {
  INQUIRY_BODY_MAX,
  INQUIRY_KIND_LABEL,
  INQUIRY_KINDS,
  type InquiryKind,
} from '../../model/support';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiField } from '../../../../shared/ui/field/field';
import { UiInput } from '../../../../shared/ui/input/input';
import { UiActionBar } from '../../../../shared/ui/action-bar/action-bar';
import { UiNotice } from '../../../../shared/ui/notice/notice';

/**
 * 문의 보내기.
 *
 * 종류를 고르고 내용을 적는다. 제목은 받지 않는다. 짧게 쓰는 사람이
 * 대부분이고 관리자는 어차피 본문을 읽기 때문이다.
 *
 * 보낸 뒤에는 목록으로 돌아간다. 방금 보낸 것이 목록 맨 위에 있어야
 * 제대로 들어갔는지 알 수 있다.
 */
@Component({
  selector: 'app-inquiry-form',
  imports: [UiButton, UiField, UiInput, UiActionBar, UiNotice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inquiry-form.html',
})
export class InquiryFormPage {
  private readonly support = inject(SUPPORT_REPOSITORY);
  readonly delivers = this.support.delivers;
  private readonly router = inject(Router);

  readonly kinds = INQUIRY_KINDS;
  readonly kindLabel = INQUIRY_KIND_LABEL;
  readonly bodyMax = INQUIRY_BODY_MAX;

  readonly kind = signal<InquiryKind>('bug');
  readonly body = signal('');
  readonly sending = signal(false);
  /** 보내기에 실패한 이유. 입력은 그대로 두고 다시 보낼 수 있게 한다. */
  readonly error = signal<string | null>(null);

  readonly canSend = computed(() => this.body().trim().length > 0 && !this.sending());

  constructor() {
    inject(PageBar).set({ title: '문의 보내기', back: ['/account/inquiries'], action: null });
  }

  pick(kind: InquiryKind): void {
    this.kind.set(kind);
  }

  async send(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canSend()) return;
    this.sending.set(true);
    this.error.set(null);
    try {
      await this.support.sendInquiry(this.kind(), this.body().trim());
      await this.router.navigateByUrl('/account/inquiries', { replaceUrl: true });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : '문의를 보내지 못했어요. 다시 시도해 주세요.');
    } finally {
      this.sending.set(false);
    }
  }
}
