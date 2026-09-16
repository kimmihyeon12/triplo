import { EnvironmentInjector, inject, runInInjectionContext } from '@angular/core';
import type { CanActivateFn, Routes } from '@angular/router';

const signedIn: CanActivateFn = () => {
  const injector = inject(EnvironmentInjector);
  return import('./features/auth/auth.routes').then((m) =>
    runInInjectionContext(injector, () => m.checkAuthentication()),
  );
};

export const routes: Routes = [
  {
    path: 'share-preview/:id',
    loadComponent: () =>
      import('./features/collaboration/feature/share-preview/share-preview').then(
        (m) => m.SharePreview,
      ),
    title: '공유 일정 미리보기',
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
    canActivate: [signedIn],
    canActivateChild: [signedIn],
    loadChildren: () => import('./features/trips/trips.routes').then((m) => m.TRIPS_ROUTES),
  },
  { path: '**', redirectTo: 'trips' },
];
