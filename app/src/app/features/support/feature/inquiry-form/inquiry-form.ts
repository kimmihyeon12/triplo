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
import { UiInput } from '../../../../shared/ui/input/input';
import { UiActionBar } from '../../../../shared/ui/action-bar/action-bar';

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
  imports: [UiButton, UiInput, UiActionBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inquiry-form.html',
})
export class InquiryFormPage {
  private readonly support = inject(SUPPORT_REPOSITORY);
  private readonly router = inject(Router);

  readonly kinds = INQUIRY_KINDS;
  readonly kindLabel = INQUIRY_KIND_LABEL;
  readonly bodyMax = INQUIRY_BODY_MAX;

  readonly kind = signal<InquiryKind>('bug');
  readonly body = signal('');
  readonly sending = signal(false);

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
    try {
      await this.support.sendInquiry(this.kind(), this.body().trim());
      await this.router.navigateByUrl('/account/inquiries', { replaceUrl: true });
    } finally {
      this.sending.set(false);
    }
  }
}
