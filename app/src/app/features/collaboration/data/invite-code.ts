/** 받은 초대 코드를 대문자로 바꾸고 문자·숫자만 남긴다. 서버도 같은 규칙으로 해시한다. */
export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** 읽기 쉽게 네 자씩 끊는다. 'ABCDEFGH' → 'ABCD-EFGH'. */
export function formatCode(code: string): string {
  const c = normalizeCode(code);
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

/** 친구에게 보낼 합류 주소. */
export function inviteLink(origin: string, code: string): string {
  return `${origin}/join/${formatCode(code)}`;
}

/** 초대 코드 길이(new_invite_code). */
export const INVITE_CODE_LENGTH = 8;

/**
 * 붙여 넣은 글에서 초대 코드를 꺼낸다(2026-10-01, 아이폰에서 링크가 Safari로 열려 앱에 붙여 넣는 경우).
 * 초대 링크 전체(…/join/ABCD-EFGH), 메시지에 섞인 링크, 코드만 넣은 경우를 모두 받는다. 아니면 null.
 */
export function inviteCodeFrom(text: string): string | null {
  const inLink = /\/join\/([A-Za-z0-9-]{8,12})/.exec(text)?.[1];
  const code = normalizeCode(inLink ?? text.trim());
  return code.length === INVITE_CODE_LENGTH ? code : null;
}
