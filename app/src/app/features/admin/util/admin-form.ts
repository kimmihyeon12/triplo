import { NOTICE_BODY_MAX, NOTICE_TITLE_MAX, REPLY_BODY_MAX } from '../model/admin-support';

/** 서버 clean_text와 같은 규칙. 앞뒤 공백을 빼고 센다. 저장 버튼을 미리 잠그는 데 쓴다. */
export function noticeTitleError(title: string): string | null {
  const t = title.trim();
  if (!t) return '제목을 입력해 주세요.';
  if (t.length > NOTICE_TITLE_MAX) return `제목은 ${NOTICE_TITLE_MAX}자까지 쓸 수 있어요.`;
  return null;
}

export function noticeBodyError(body: string): string | null {
  const b = body.trim();
  if (!b) return '본문을 입력해 주세요.';
  if (b.length > NOTICE_BODY_MAX) return `본문은 ${NOTICE_BODY_MAX}자까지 쓸 수 있어요.`;
  return null;
}

export function noticeFormError(title: string, body: string): string | null {
  return noticeTitleError(title) ?? noticeBodyError(body);
}

export function replyFormError(body: string): string | null {
  const b = body.trim();
  if (!b) return '답변을 입력해 주세요.';
  if (b.length > REPLY_BODY_MAX) return `답변은 ${REPLY_BODY_MAX}자까지 쓸 수 있어요.`;
  return null;
}
