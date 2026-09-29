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
