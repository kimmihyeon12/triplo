import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageBar } from '../../../../core/page-bar';
import { UiBadge } from '../../../../shared/ui/badge/badge';
import type { BadgeTone } from '../../../../shared/util/badge-tone';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { UiNotice } from '../../../../shared/ui/notice/notice';
import { UiSpinner } from '../../../../shared/ui/spinner/spinner';
import { formatKoreanDate } from '../../../../shared/util/dates';
import { INQUIRY_KIND_LABEL, INQUIRY_STATUS_LABEL, type InquiryStatus } from '../../../support/model/support';
import { AdminSupport, isAdminDenied } from '../../data/admin-support';
import { adminExit } from '../admin-exit';
import type { AdminInquiry } from '../../model/admin-support';
import { filterInquiries, openCount, type InquiryFilter } from '../../util/inquiry-filter';

/** 관리자 문의 목록. 접수됨부터 보이고 상태로 거른다. */
@Component({
  selector: 'app-admin-inquiries',
  imports: [RouterLink, UiBadge, IconComponent, UiNotice, UiSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-inquiries.html',
})
export class AdminInquiries {
  private readonly support = inject(AdminSupport);
  private readonly exit = adminExit();
  readonly kindLabel = INQUIRY_KIND_LABEL;
  readonly statusLabel = INQUIRY_STATUS_LABEL;
  readonly filters: readonly { value: InquiryFilter; label: string }[] = [
    { value: 'all', label: '전체' },
    { value: 'open', label: INQUIRY_STATUS_LABEL.open },
    { value: 'reading', label: INQUIRY_STATUS_LABEL.reading },
    { value: 'answered', label: INQUIRY_STATUS_LABEL.answered },
  ];

  readonly inquiries = signal<AdminInquiry[] | null>(null);
  readonly filter = signal<InquiryFilter>('all');
  readonly error = signal<string | null>(null);
  readonly shown = computed(() => filterInquiries(this.inquiries() ?? [], this.filter()));
  readonly open = computed(() => openCount(this.inquiries() ?? []));

  constructor() {
    inject(PageBar).set({ title: '문의 관리', back: ['/admin'], action: null });
    void this.load();
  }

  async load(): Promise<void> {
    try {
      this.inquiries.set(await this.support.inquiries());
      this.error.set(null);
    } catch (error) {
      if (isAdminDenied(error)) {
        void this.exit.denied();
        return;
      }
      this.error.set(error instanceof Error ? error.message : '문의를 불러오지 못했어요.');
    }
  }

  tone(status: InquiryStatus): BadgeTone {
    return status === 'answered' ? 'ok' : status === 'open' ? 'warn' : 'neutral';
  }

  day(iso: string): string {
    return formatKoreanDate(iso.slice(0, 10), { short: true });
  }
}
