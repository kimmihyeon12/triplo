import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageBar } from '../../../../core/page-bar';
import { SUPPORT_REPOSITORY } from '../../data/support-repository';
import { INQUIRY_KIND_LABEL, INQUIRY_STATUS_LABEL, type Inquiry } from '../../model/support';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiBadge } from '../../../../shared/ui/badge/badge';
import { UiSpinner } from '../../../../shared/ui/spinner/spinner';
import { UiActionBar } from '../../../../shared/ui/action-bar/action-bar';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import type { BadgeTone } from '../../../../shared/util/badge-tone';

/**
 * 보낸 문의 목록.
 *
 * 이 화면을 여는 이유는 대개 답변을 확인하기 위해서다. 그래서 목록을
 * 기본으로 두고 새 문의는 하단 버튼으로 보낸다. 쓰는 폼을 위에 두면
 * 답변을 보러 온 사람이 매번 빈 입력란을 지나쳐야 한다.
 */
@Component({
  selector: 'app-inquiries',
  imports: [UiButton, UiBadge, UiSpinner, UiActionBar, IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inquiries.html',
})
export class InquiriesPage {
  private readonly support = inject(SUPPORT_REPOSITORY);

  readonly kindLabel = INQUIRY_KIND_LABEL;
  readonly statusLabel = INQUIRY_STATUS_LABEL;

  readonly list = signal<Inquiry[]>([]);
  readonly loading = signal(true);

  constructor() {
    inject(PageBar).set({ title: '문의하기', back: ['/account'], action: null });
    void this.load();
  }

  private async load(): Promise<void> {
    this.list.set(await this.support.inquiries());
    this.loading.set(false);
  }

  /** 답변을 열면 읽은 것으로 본다. 내 정보의 개수 표시가 줄어든다. */
  async open(inquiry: Inquiry): Promise<void> {
    if (inquiry.replies.length === 0 || inquiry.readAt) return;
    await this.support.markInquiryRead(inquiry.id);
    await this.load();
  }

  tone(inquiry: Inquiry): BadgeTone {
    if (inquiry.status === 'answered') return 'ok';
    if (inquiry.status === 'reading') return 'warn';
    return 'neutral';
  }

  day(iso: string): string {
    const d = new Date(iso);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}.${mm}.${dd}`;
  }
}
