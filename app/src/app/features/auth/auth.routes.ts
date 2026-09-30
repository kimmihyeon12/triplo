import { inject } from '@angular/core';
import { Router, type Routes, type UrlTree } from '@angular/router';
import { AuthStore } from './data/auth-store';
import { SUPPORT_ROUTES } from '../support/support.routes';
import { environment } from '../../../environments/environment';

export async function checkAuthentication(): Promise<boolean | UrlTree> {
  if (environment.designPreview) return true;
  if (sessionStorage.getItem('tc.preview.v1') === '1') return true;
  const auth = inject(AuthStore);
  const router = inject(Router);
  await auth.initialize();
  if (!auth.user()) return router.createUrlTree(['/login']);
  return auth.nickname() ? true : router.createUrlTree(['/onboarding']);
}

async function needsNickname(): Promise<boolean | UrlTree> {
  if (environment.designPreview) return true;
  const auth = inject(AuthStore);
  const router = inject(Router);
  await auth.initialize();
  if (!auth.user()) return router.createUrlTree(['/login']);
  return auth.nickname() ? router.createUrlTree(['/trips']) : true;
}

export const ONBOARDING_ROUTES: Routes = [
  {
    path: '',
    canActivate: [needsNickname],
    loadComponent: () => import('./feature/onboarding/onboarding').then((m) => m.OnboardingPage),
    title: '닉네임 설정',
  },
];

export const ACCOUNT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [checkAuthentication],
    loadComponent: () => import('./feature/account/account').then((m) => m.AccountPage),
    title: '내 정보',
  },
  // 공지·문의·약관은 support feature가 어느 주소에 붙을지 정한다.
  // 약관·처리방침은 가입 전에 읽을 수 있어야 하므로 로그인을 묻지 않는다. 로그인 화면이
  // '동의하는 것으로 본다'고 적으면서 읽을 길을 막고 있었다(2026-09-30 감리 P2-03).
  ...SUPPORT_ROUTES.map((route) =>
    route.data?.['kind'] ? route : { ...route, canActivate: [checkAuthentication] },
  ),
];
