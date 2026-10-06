import { effect, inject } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { environment } from '../../../../environments/environment';
import { AuthStore } from '../../auth/data/auth-store';
import { SupabasePushRepository } from './supabase-push-repository';

/**
 * 앱을 열면 이 기기의 푸시 구독을 서버에 다시 남긴다(2026-10-06 공지 미수신 수정).
 * 화면은 브라우저 구독만 보고 '켜짐'으로 보여 주는데 서버 구독이 지워져 있으면 공지가 오지 않았다.
 * 로그인한 계정이 정해질 때마다 한 번 부른다. 테스트 앱·미리보기는 실제 구독이 없어 건너뛴다.
 */
export function startPushResync(): void {
  if (environment.isTest || environment.designPreview) return;
  const swPush = inject(SwPush);
  if (!swPush.isEnabled || typeof Notification === 'undefined') return;
  const auth = inject(AuthStore);
  const repo = new SupabasePushRepository(swPush, () => auth.dataClient(), {
    userAgent: navigator.userAgent,
    standalone:
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    maxTouchPoints: navigator.maxTouchPoints,
    permission: () => Notification.permission,
  });
  let done: string | null = null;
  effect(() => {
    const id = auth.user()?.id ?? null;
    if (!id || id === done) return;
    done = id;
    // 실패해도 앱 사용에는 영향이 없다. 다음에 열 때 다시 맞춘다.
    void repo.resync().catch(() => false);
  });
}
