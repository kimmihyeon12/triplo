import { describe, expect, it } from 'vitest';
import { kakaoExternalUrl } from './open-external';

const KAKAO_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36;KAKAOTALK 2410130';
const KAKAO_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.0';
const SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

describe('카카오톡 브라우저에서 외부로 열기', () => {
  it('카카오톡 안이면 외부 열기 주소로 넘긴다', () => {
    const href = 'https://triplo.pages.dev/join/ABCD-EFGH';
    const expected = 'kakaotalk://web/openExternal?url=https%3A%2F%2Ftriplo.pages.dev%2Fjoin%2FABCD-EFGH';
    expect(kakaoExternalUrl(KAKAO_ANDROID, href)).toBe(expected);
    expect(kakaoExternalUrl(KAKAO_IOS, href)).toBe(expected);
  });

  it('다른 브라우저는 그대로 둔다', () => {
    expect(kakaoExternalUrl(SAFARI, 'https://triplo.pages.dev/join/ABCD-EFGH')).toBeNull();
  });
});
