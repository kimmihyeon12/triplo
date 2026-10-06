import { InjectionToken, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { AuthStore } from '../../auth/data/auth-store';
import type { KeyValueStorage } from './local-push-repository';
import { LocalNotificationInbox, SupabaseNotificationInbox, type NotificationInbox } from './notification-inbox';

/** 저장소 접근이 막힌 브라우저에서도 화면은 뜬다. */
const safeStorage: KeyValueStorage = {
  getItem: (key) => {
    try {
      return globalThis.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      globalThis.localStorage.setItem(key, value);
    } catch {
      // 저장하지 못해도 화면은 계속 쓴다.
    }
  },
};

/**
 * 내 정보(안 읽은 수)와 알림 내역 화면이 함께 쓴다. 실행 앱은 Supabase, 테스트 앱·미리보기는 기기 저장.
 */
export const NOTIFICATION_INBOX = new InjectionToken<NotificationInbox>('NOTIFICATION_INBOX', {
  providedIn: 'root',
  factory: () => {
    const auth = inject(AuthStore);
    if (environment.isTest || environment.designPreview)
      return new LocalNotificationInbox(safeStorage, () => `${environment.storageKey}.inbox.${auth.user()?.id ?? 'guest'}`);
    return new SupabaseNotificationInbox(() => auth.dataClient());
  },
});
