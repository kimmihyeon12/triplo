import { describe, expect, it } from 'vitest';
import { formatCode, inviteCodeFrom, inviteLink, normalizeCode } from './invite-code';

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

describe('붙여 넣은 초대 링크에서 코드 꺼내기', () => {
  it('링크 전체·메시지에 섞인 링크·코드만 모두 받는다', () => {
    expect(inviteCodeFrom('https://triplo.pages.dev/join/ABCD-EFGH')).toBe('ABCDEFGH');
    expect(inviteCodeFrom('강릉 여행 같이 짜요! https://triplo.pages.dev/join/abcd-efgh 눌러서 들어와')).toBe('ABCDEFGH');
    expect(inviteCodeFrom(' abcd-efgh ')).toBe('ABCDEFGH');
  });

  it('초대 코드가 아니면 null', () => {
    expect(inviteCodeFrom('https://triplo.pages.dev/trips/123')).toBeNull();
    expect(inviteCodeFrom('ABC')).toBeNull();
    expect(inviteCodeFrom('')).toBeNull();
  });
});
