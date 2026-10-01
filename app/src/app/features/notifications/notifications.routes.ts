import { inject } from '@angular/core';
import type { Routes } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../auth/data/auth-store';
import { PUSH_REPOSITORY } from './data/push-repository';
import { LocalPushRepository, type KeyValueStorage } from './data/local-push-repository';
import { SupabasePushRepository } from './data/supabase-push-repository';

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
 * 알림 설정 화면의 라우트. 계정 라우트가 이 목록을 이어 붙인다.
 * 구독 저장소는 이 화면을 열 때만 받도록 라우트에서 제공한다(첫 화면 번들에 넣지 않는다).
 * 테스트 앱·미리보기는 실제 구독 없이 계정별 기기 저장을 쓴다.
 */
export const NOTIFICATION_ROUTES: Routes = [
  {
    path: 'notifications',
    providers: [
      {
        provide: PUSH_REPOSITORY,
        useFactory: () => {
          const auth = inject(AuthStore);
          if (environment.isTest || environment.designPreview)
            return new LocalPushRepository(safeStorage, () => `${environment.storageKey}.push.${auth.user()?.id ?? 'guest'}`);
          return new SupabasePushRepository(inject(SwPush), () => auth.dataClient(), {
            userAgent: navigator.userAgent,
            standalone:
              window.matchMedia?.('(display-mode: standalone)').matches ||
              (navigator as Navigator & { standalone?: boolean }).standalone === true,
            maxTouchPoints: navigator.maxTouchPoints,
            permission: () => (typeof Notification === 'undefined' ? null : Notification.permission),
          });
        },
      },
    ],
    loadComponent: () =>
      import('./feature/notification-settings/notification-settings').then((m) => m.NotificationSettingsPage),
    title: '알림',
  },
];
