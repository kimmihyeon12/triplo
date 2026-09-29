import { describe, expect, it } from 'vitest';
import { mapAppLink, mobilePlatform } from './map-app-link';

const naver = 'https://map.naver.com/p/search/%EA%B2%BD%ED%8F%AC%EB%8C%80';
const kakao = 'https://map.kakao.com/?q=%EA%B2%BD%ED%8F%AC%EB%8C%80';

describe('mapAppLink', () => {
  it('아이폰은 앱 스킴을 돌려준다', () => {
    expect(mapAppLink(naver, 'ios', 'triplo.pages.dev')).toBe(
      'nmap://search?query=%EA%B2%BD%ED%8F%AC%EB%8C%80&appname=triplo.pages.dev',
    );
    expect(mapAppLink(kakao, 'ios', 'triplo.pages.dev')).toBe('kakaomap://search?q=%EA%B2%BD%ED%8F%AC%EB%8C%80');
  });

  it('안드로이드는 앱이 없으면 웹으로 가는 intent 주소를 돌려준다', () => {
    expect(mapAppLink(naver, 'android', 'triplo.pages.dev')).toBe(
      'intent://search?query=%EA%B2%BD%ED%8F%AC%EB%8C%80&appname=triplo.pages.dev#Intent;scheme=nmap;package=com.nhn.android.nmap;S.browser_fallback_url=' +
        encodeURIComponent(naver) +
        ';end',
    );
    expect(mapAppLink(kakao, 'android', 'triplo.pages.dev')).toBe(
      'intent://search?q=%EA%B2%BD%ED%8F%AC%EB%8C%80#Intent;scheme=kakaomap;package=net.daum.android.map;S.browser_fallback_url=' +
        encodeURIComponent(kakao) +
        ';end',
    );
  });

  it('지도 주소가 아니거나 데스크톱이면 null', () => {
    expect(mapAppLink('https://example.com', 'ios', 'x')).toBeNull();
    expect(mapAppLink(naver, null, 'x')).toBeNull();
  });
});

describe('mobilePlatform', () => {
  it('사용자 에이전트로 휴대폰을 가린다', () => {
    expect(mobilePlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 0)).toBe('ios');
    expect(mobilePlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios');
    expect(mobilePlatform('Mozilla/5.0 (Linux; Android 15; SM-S928N)', 5)).toBe('android');
    expect(mobilePlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0)).toBeNull();
  });
});
