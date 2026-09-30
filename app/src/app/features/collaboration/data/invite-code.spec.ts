import { describe, expect, it } from 'vitest';
import { formatCode, inviteLink, normalizeCode } from './invite-code';

describe('invite code', () => {
  it('대문자로 바꾸고 문자·숫자만 남긴다', () => {
    expect(normalizeCode(' abcd-ef gh ')).toBe('ABCDEFGH');
  });

  it('네 자씩 끊어 보인다', () => {
    expect(formatCode('ABCDEFGH')).toBe('ABCD-EFGH');
    expect(formatCode('abcd-efgh')).toBe('ABCD-EFGH');
  });

  it('합류 주소를 만든다', () => {
    expect(inviteLink('https://triplo.pages.dev', 'ABCDEFGH')).toBe('https://triplo.pages.dev/join/ABCD-EFGH');
  });
});
