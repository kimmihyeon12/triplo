import type { Inquiry, InquiryKind, Notice } from '../model/support';
import type { SupportDataClient } from './support-data-client';
import type { SupportRepository } from './support-repository';
import { hasNewAnswer, toInquiry, toNotice } from './support-rows';

/**
 * 공지·문의를 Supabase에 저장한다(2026-10-01). 쓰기는 서버 함수로만 한다.
 * 초안 공지와 남의 문의는 서버 RLS가 막는다.
 */
export class SupabaseSupportRepository implements SupportRepository {
  readonly delivers = true;

  constructor(
    private readonly client: SupportDataClient,
    private readonly appVersion: string,
    private readonly userAgent: () => string,
  ) {}

  async notices(): Promise<Notice[]> {
    return (await this.client.publishedNotices()).map(toNotice);
  }

  async unreadNoticeIds(): Promise<string[]> {
    const [notices, read] = await Promise.all([this.client.publishedNotices(), this.client.readNoticeIds()]);
    const seen = new Set(read);
    return notices.filter((n) => !seen.has(n.id)).map((n) => n.id);
  }

  async unreadNoticeCount(): Promise<number> {
    return (await this.unreadNoticeIds()).length;
  }

  async markNoticesRead(): Promise<void> {
    await this.client.call('mark_notices_read', undefined);
  }

  async inquiries(): Promise<Inquiry[]> {
    const rows = await this.client.myInquiries();
    return rows.map(toInquiry).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async unansweredReadCount(): Promise<number> {
    return (await this.client.myInquiries()).filter(hasNewAnswer).length;
  }

  async sendInquiry(kind: InquiryKind, body: string): Promise<Inquiry> {
    const id = (await this.client.call('send_inquiry', {
      p_kind: kind,
      p_body: body,
      p_app_version: this.appVersion,
      p_user_agent: this.userAgent(),
    })) as string;
    const sent = (await this.inquiries()).find((i) => i.id === id);
    if (!sent) throw new Error('보낸 문의를 다시 읽지 못했어요.');
    return sent;
  }

  async markInquiryRead(id: string): Promise<void> {
    await this.client.call('mark_inquiry_read', { p_id: id });
  }
}
