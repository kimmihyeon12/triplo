/**
 * 앱 설치로 보낼 곳(2026-10-01). 지금은 홈 화면에 추가하는 안내 화면(/install)이다.
 * 앱스토어·플레이스토어에 배포하면 여기만 스토어 주소로 바꾼다(사용자 결정).
 */
export const INSTALL_PATH = '/install';

/** 설치 화면 주소. 설치하지 않고 웹에서 계속할 때 돌아올 곳(next)을 함께 넘긴다. */
export function installUrl(next: string): string {
  return `${INSTALL_PATH}?next=${encodeURIComponent(next)}`;
}

/** 앱 안 주소만 돌아갈 곳으로 받는다(바깥 주소로 보내지 않는다). */
export function safeNext(next: string | null | undefined): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}
