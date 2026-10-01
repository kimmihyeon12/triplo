/**
 * 카카오톡 안의 브라우저로 열린 초대 링크를 바깥으로 넘긴다(2026-10-01 사용자 요청).
 * 카카오톡은 링크를 자기 안의 브라우저로 열어, 설치한 앱으로 가지 않고 로그인도 따로 해야 한다.
 * 카카오톡이 제공하는 외부 열기 주소로 넘기면
 * - 안드로이드: 기본 브라우저로 여는데, 크롬으로 설치한 앱(WebAPK)이 그 주소를 맡아 앱에서 열린다.
 * - 아이폰: Safari로 열린다(아이폰은 홈 화면 앱으로 링크를 넘기지 못한다). Safari 초대 화면이 앱에서 여는 방법을 안내한다.
 */

/** 카카오톡 안의 브라우저면 외부로 여는 주소, 아니면 null. */
export function kakaoExternalUrl(userAgent: string, href: string): string | null {
  if (!/KAKAOTALK/i.test(userAgent)) return null;
  return `kakaotalk://web/openExternal?url=${encodeURIComponent(href)}`;
}
