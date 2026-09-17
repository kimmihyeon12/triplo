import { InjectionToken } from '@angular/core';
import type { Inquiry, InquiryKind, Notice } from '../model/support';

/**
 * 화면은 이 인터페이스만 사용한다. 지금은 기기 저장 구현을 쓰고,
 * Supabase 연결 단계에서 같은 인터페이스의 서버 구현으로 교체한다.
 */
export interface SupportRepository {
  /** 발행된 공지만 최신순으로 돌려준다. */
  notices(): Promise<Notice[]>;
  /** 아직 읽지 않은 공지 수. 내 정보 화면의 빨간 점에 쓴다. */
  unreadNoticeCount(): Promise<number>;
  /** 읽지 않은 공지의 id. 목록에서 어느 글에 표시를 붙일지 정한다. */
  unreadNoticeIds(): Promise<string[]>;
  markNoticesRead(): Promise<void>;

  inquiries(): Promise<Inquiry[]>;
  /** 답변이 달렸는데 아직 읽지 않은 문의 수. */
  unansweredReadCount(): Promise<number>;
  sendInquiry(kind: InquiryKind, body: string): Promise<Inquiry>;
  markInquiryRead(id: string): Promise<void>;
}

export const SUPPORT_REPOSITORY = new InjectionToken<SupportRepository>('SUPPORT_REPOSITORY');
