import type { Routes } from '@angular/router';

/** 구름이가 안내하는 사용법의 라우트. 계정 라우트가 이어 붙인다(/account/guide). */
export const GUIDE_ROUTES: Routes = [
  {
    path: 'guide',
    loadComponent: () => import('./feature/guide/guide').then((m) => m.GuidePage),
    title: '사용법',
  },
];
