/**
 * 네이버·카카오 지도 웹 주소를 휴대폰에서 앱으로 바로 여는 주소로 바꾼다.
 * 웹 주소를 그대로 열면 브라우저가 웹 지도를 먼저 띄운 뒤에야 앱으로 넘어갔다
 * (2026-09-29 사용자 요청).
 *
 * - 안드로이드: intent 주소. 앱이 없으면 브라우저가 스스로 웹 주소로 간다.
 * - 아이폰: 앱 스킴. 앱이 없으면 여는 쪽(appMapLink)이 잠시 뒤 웹 주소로 보낸다.
 * - 데스크톱: null(웹 주소 그대로).
 */
export type MobilePlatform = 'ios' | 'android';

export function mobilePlatform(userAgent: string, maxTouchPoints: number): MobilePlatform | null {
  if (/Android/i.test(userAgent)) return 'android';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  // 아이패드 사파리는 맥으로 자신을 알리므로 터치 지원으로 가린다.
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ios';
  return null;
}

interface AppTarget {
  scheme: string;
  pkg: string;
  path: string;
}

function target(webUrl: string, appName: string): AppTarget | null {
  let url: URL;
  try {
    url = new URL(webUrl);
  } catch {
    return null;
  }
  if (url.hostname === 'map.naver.com') {
    const match = url.pathname.match(/^\/p\/search\/(.+)$/);
    if (!match) return null;
    return {
      scheme: 'nmap',
      pkg: 'com.nhn.android.nmap',
      path: `search?query=${match[1]}&appname=${encodeURIComponent(appName)}`,
    };
  }
  if (url.hostname === 'map.kakao.com') {
    const q = url.searchParams.get('q');
    if (!q) return null;
    return { scheme: 'kakaomap', pkg: 'net.daum.android.map', path: `search?q=${encodeURIComponent(q)}` };
  }
  return null;
}

export function mapAppLink(webUrl: string, platform: MobilePlatform | null, appName: string): string | null {
  if (!platform) return null;
  const t = target(webUrl, appName);
  if (!t) return null;
  if (platform === 'ios') return `${t.scheme}://${t.path}`;
  return (
    `intent://${t.path}#Intent;scheme=${t.scheme};package=${t.pkg};` +
    `S.browser_fallback_url=${encodeURIComponent(webUrl)};end`
  );
}
