import type { Routes } from '@angular/router';

/**
 * 대화 화면의 공개 라우트. 여행 아래에 붙지만 화면은 이 기능이 갖는다.
 * 다른 기능이 내부 파일을 직접 가리키면 경로가 바뀔 때마다 밖에서 고쳐야 한다.
 */
export const CHAT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./feature/chat/chat').then((m) => m.ChatPage),
    title: '대화로 찾기',
  },
];
