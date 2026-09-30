import type { Inquiry, InquiryKind, InquiryStatus, Notice } from '../model/support';

/** 서버 표의 행 모양. 이름은 DB의 snake_case를 그대로 쓴다. */
export interface NoticeRow {
  id: string;
  title: string;
  body: string;
  status: 'draft' | 'published';
  generated: boolean;
  release_tag: string;
  created_at: string;
  published_at: string | null;
}

export interface ReplyRow {
  id: string;
  body: string;
  author_role: 'user' | 'admin';
  created_at: string;
}

export interface InquiryRow {
  id: string;
  user_id: string;
  sender_nickname: string;
  kind: InquiryKind;
  body: string;
  status: InquiryStatus;
  app_version: string;
  user_agent: string;
  answer_read_at: string | null;
  created_at: string;
  inquiry_replies: ReplyRow[];
}

export function toNotice(row: NoticeRow): Notice {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status,
    generated: row.generated,
    releaseTag: row.release_tag,
    createdAt: row.created_at,
    publishedAt: row.published_at,
  };
}

const byTime = (a: ReplyRow, b: ReplyRow) => a.created_at.localeCompare(b.created_at);

/** 마지막 답변이 사용자가 확인한 시각보다 나중이면 새 답변이다. 관리자가 다시 답하면 다시 새 답변이 된다. */
export function hasNewAnswer(row: InquiryRow): boolean {
  const last = [...row.inquiry_replies].sort(byTime).at(-1);
  return !!last && (!row.answer_read_at || last.created_at > row.answer_read_at);
}

export function toInquiry(row: InquiryRow): Inquiry {
  return {
    id: row.id,
    kind: row.kind,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    appVersion: row.app_version,
    userAgent: row.user_agent,
    replies: [...row.inquiry_replies].sort(byTime).map((r) => ({ id: r.id, body: r.body, createdAt: r.created_at })),
    // 화면은 readAt이 없으면 새 답변으로 본다. 새 답변이 있으면 확인 시각을 비워 둔다.
    readAt: hasNewAnswer(row) ? null : row.answer_read_at,
  };
}
