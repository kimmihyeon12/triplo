import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from '../../../core/toast-service';

/**
 * 관리자 화면에서 더 머물 수 없을 때 이유를 알리고 떠난다.
 * 토스트는 화면을 옮겨도 남는다. 주입 문맥(필드 초기화)에서 부른다.
 */
export function adminExit() {
  const router = inject(Router);
  const toast = inject(ToastService);
  const leave = (message: string, url: string) => {
    toast.error(message);
    return router.navigateByUrl(url, { replaceUrl: true });
  };
  return {
    /** 서버가 관리자 권한을 거절했다. */
    denied: () => leave('관리자 권한이 없어요.', '/account'),
    /** 다른 관리자가 지웠거나 없는 주소다. */
    missing: (message: string, list: string) => leave(message, list),
  };
}
