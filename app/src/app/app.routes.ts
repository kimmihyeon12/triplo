import { EnvironmentInjector, inject, runInInjectionContext } from '@angular/core';
import type { CanActivateFn, Routes } from '@angular/router';

const signedIn: CanActivateFn = () => {
  const injector = inject(EnvironmentInjector);
  return import('./features/auth/auth.routes').then((m) =>
    runInInjectionContext(injector, () => m.checkAuthentication()),
  );
};

const guideFirst: CanActivateFn = (_route, state) => {
  const injector = inject(EnvironmentInjector);
  return import('./features/auth/auth.routes').then((m) =>
    runInInjectionContext(injector, () => m.offerGuide(state.url.split('?')[0]!)),
  );
};

export const routes: Routes = [
  {
    // 초대 링크를 앱에 붙여 넣어 열기(2026-10-01). 아이폰은 링크가 Safari로 열려 앱으로 가져온다.
    path: 'join',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/collaboration/feature/join-paste/join-paste').then((m) => m.JoinPaste),
    title: '초대 링크로 참여',
  },
  {
    // 초대 링크. 로그인 전에도 보기 전용으로 열리므로 가드를 두지 않는다.
    path: 'join/:code',
    loadComponent: () =>
      import('./features/collaboration/feature/join/join').then((m) => m.Join),
    title: '여행 초대',
  },
  { path: '', pathMatch: 'full', redirectTo: 'trips' },
  {
    path: 'lab',
    loadComponent: () => import('./features/lab/feature/lab/lab').then((m) => m.LabPage),
    title: '실험실 · 디자인 시스템',
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/feature/login/login').then((m) => m.LoginPage),
    title: '로그인',
  },
  {
    // 설치 방법은 기기마다 달라 안내 화면을 따로 둔다. 로그인 없이 열 수 있다.
    path: 'install',
    loadComponent: () => import('./features/install/feature/install/install').then((m) => m.Install),
    title: '앱 설치',
  },
  {
    path: 'auth/callback',
    loadComponent: () => import('./features/auth/feature/login/login').then((m) => m.LoginPage),
    title: '로그인 확인',
  },
  {
    path: 'account',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.ACCOUNT_ROUTES),
  },
  {
    path: 'onboarding',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.ONBOARDING_ROUTES),
  },
  {
    path: 'trips',
    canActivate: [signedIn, guideFirst],
    canActivateChild: [signedIn],
    loadChildren: () => import('./features/trips/trips.routes').then((m) => m.TRIPS_ROUTES),
  },
  {
    path: 'stats',
    canActivate: [signedIn],
    loadChildren: () => import('./features/stats/stats.routes').then((m) => m.STATS_ROUTES),
  },
  {
    // 로그인 확인은 관리자 가드 안에서 먼저 한다.
    path: 'admin',
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  { path: '**', redirectTo: 'trips' },
];
