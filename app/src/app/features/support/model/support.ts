/**
 * 공지사항과 문의 도메인 모델.
 *
 * 화면과 저장소가 함께 쓴다. 날짜는 ISO 문자열로 두어 저장 형식과
 * 화면 표시를 분리한다.
 */

/** 공지 상태. 초안은 관리자만 보고, 발행된 것만 사용자에게 간다. */
export type NoticeStatus = 'draft' | 'published';

export interface Notice {
  id: string;
  title: string;
  body: string;
  status: NoticeStatus;
  /** 배포 스크립트가 만든 것이면 true. 관리자가 직접 쓴 것과 구분한다. */
  generated: boolean;
  /** 이 공지가 딸린 배포 태그. 손으로 쓴 공지는 빈 문자열이다. */
  releaseTag: string;
  createdAt: string;
  /** 발행 시각. 초안이면 null이다. */
  publishedAt: string | null;
}

export type InquiryKind = 'bug' | 'idea' | 'account' | 'etc';

export const INQUIRY_KIND_LABEL: Record<InquiryKind, string> = {
  bug: '오류 신고',
  idea: '기능 제안',
  account: '계정 문의',
  etc: '기타',
};

/** 화면에 칩을 그리는 순서. 오류 신고가 가장 많을 종류라 앞에 둔다. */
export const INQUIRY_KINDS: InquiryKind[] = ['bug', 'idea', 'account', 'etc'];

/**
 * 문의 상태.
 *
 * 'open'은 아직 읽지 않은 것, 'reading'은 관리자가 확인 중인 것,
 * 'answered'는 답변이 달린 것이다.
 */
export type InquiryStatus = 'open' | 'reading' | 'answered';

export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  open: '접수됨',
  reading: '확인 중',
  answered: '답변 완료',
};

export interface InquiryReply {
  id: string;
  body: string;
  createdAt: string;
}

export interface Inquiry {
  id: string;
  kind: InquiryKind;
  body: string;
  status: InquiryStatus;
  createdAt: string;
  /** 오류 신고에서 기기를 다시 묻지 않으려고 함께 보낸다. */
  appVersion: string;
  userAgent: string;
  replies: InquiryReply[];
  /** 답변을 읽었는지. 내 정보 화면의 개수 표시에 쓴다. */
  readAt: string | null;
}

/** 문의 본문 길이 상한. 화면의 글자 수 표시와 같은 값을 쓴다. */
export const INQUIRY_BODY_MAX = 1000;
