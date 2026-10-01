/** 계정마다 받을 알림 종류. 기본은 모두 켬. */
export interface NotificationSettings {
  readonly replies: boolean;
  readonly notices: boolean;
  readonly together: boolean;
}

export const DEFAULT_SETTINGS: NotificationSettings = { replies: true, notices: true, together: true };

/**
 * 이 기기에서 알림을 받을 수 있는 상태.
 * - on: 구독 중
 * - off: 받을 수 있지만 꺼 둠
 * - denied: 브라우저에서 알림 권한을 거부함. 앱이 다시 물을 수 없다
 * - install-required: 아이폰·아이패드에서 홈 화면에 설치하지 않음(애플 제한)
 * - unsupported: 이 브라우저는 웹 푸시를 지원하지 않음
 */
export type DeviceState = 'on' | 'off' | 'denied' | 'install-required' | 'unsupported';

/** 아이폰·아이패드 Safari 탭인지. 홈 화면에 설치한 앱이어야 알림을 받는다. */
export function needsInstall(userAgent: string, standalone: boolean, maxTouchPoints: number): boolean {
  const apple = /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  return apple && !standalone;
}
