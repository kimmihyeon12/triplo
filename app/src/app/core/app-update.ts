import { DestroyRef, inject } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { freshlyOpened } from './app-update-timing';
import { ToastService } from './toast-service';

/**
 * 새 버전 반영(2026-10-01 사용자 지적: 알림을 눌러 들어가면 옛 버전이 떴다).
 * 서비스 워커는 열 때 기기에 저장된 버전을 먼저 보여 주고 새 버전은 뒤에서 받아 둔다.
 * 열거나 앱으로 돌아올 때 새 버전을 확인하고, 막 연 참이면 바로 새로고침한다.
 * 쓰는 중일 수 있는 때는 입력이 날아가지 않게 알림으로 묻는다.
 * 시간 판단은 서비스 워커 없이 시험하도록 app-update-timing.ts에 둔다.
 */

export function startAppUpdates(): void {
  const updates = inject(SwUpdate);
  if (!updates.isEnabled) return;
  const toast = inject(ToastService);
  let openedAt = Date.now();
  const reload = () => document.location.reload();
  const check = () => void updates.checkForUpdate().catch(() => undefined);

  const sub = updates.versionUpdates.subscribe((event) => {
    if (event.type !== 'VERSION_READY') return;
    if (freshlyOpened(openedAt, Date.now())) {
      void updates.activateUpdate().then(reload, reload);
      return;
    }
    toast.update('새 버전이 있어요.', { label: '새로고침', run: () => void updates.activateUpdate().then(reload, reload) });
  });
  // 저장된 파일이 지워져 지금 화면을 이어 갈 수 없으면 새로 불러온다.
  const broken = updates.unrecoverable.subscribe(() => reload());
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    openedAt = Date.now();
    check();
  };
  document.addEventListener('visibilitychange', onVisible);
  check();
  inject(DestroyRef).onDestroy(() => {
    sub.unsubscribe();
    broken.unsubscribe();
    document.removeEventListener('visibilitychange', onVisible);
  });
}
