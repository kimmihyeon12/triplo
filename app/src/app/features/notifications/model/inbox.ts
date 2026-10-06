/** 알림 종류. 서버 notification_inbox.kind와 같다. */
export type InboxKind = 'reply' | 'notice' | 'join' | 'trip' | 'ledger';

/** 알림 내역 한 줄(2026-10-06). 30일이 지나면 서버가 지운다. */
export interface InboxItem {
  readonly id: string;
  readonly kind: InboxKind;
  readonly title: string;
  readonly body: string;
  /** 누르면 열 앱 안 주소. 서버가 정한 값이다. */
  readonly url: string;
  readonly createdAt: string;
  readonly read: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * 알림 시각. 오늘이면 '방금'·'n분 전'·'n시간 전', 어제면 '어제', 그 전은 '10.03'.
 * 내역은 30일까지라 연도는 붙이지 않는다. 기기 시간대로 센다.
 */
export function inboxTime(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const sameDay = at.toDateString() === now.toDateString();
  if (sameDay) return `${Math.floor(minutes / 60)}시간 전`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (at.toDateString() === yesterday.toDateString()) return '어제';
  return `${pad(at.getMonth() + 1)}.${pad(at.getDate())}`;
}

/** 서버가 준 주소가 앱 안 경로일 때만 따라간다. 바깥 주소는 열지 않는다. */
export function safeInboxUrl(url: string): string | null {
  return url.startsWith('/') && !url.startsWith('//') ? url : null;
}
