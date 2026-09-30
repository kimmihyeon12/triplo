import type { InquiryStatus } from '../../support/model/support';
import type { AdminInquiry } from '../model/admin-support';

export type InquiryFilter = 'all' | InquiryStatus;

export function filterInquiries(list: readonly AdminInquiry[], filter: InquiryFilter): AdminInquiry[] {
  return filter === 'all' ? [...list] : list.filter((i) => i.status === filter);
}

/** 아직 아무도 확인하지 않은 문의 수. 목록 위에 보여 처리할 것이 남았는지 알린다. */
export function openCount(list: readonly AdminInquiry[]): number {
  return list.filter((i) => i.status === 'open').length;
}
