import type { Routes } from '@angular/router';

/**
 * 동행·초대의 공개 진입점. 여행 상세 아래에 붙지만 화면은 이 기능이 갖는다.
 * 다른 기능이 내부 파일을 직접 가리키면 경로가 바뀔 때마다 밖에서 고쳐야 한다.
 */
export const INVITE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./feature/invite/invite').then((m) => m.Invite),
  },
];
