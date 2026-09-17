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
  ...SUPPORT_ROUTES.map((route) => ({ ...route, canActivate: [checkAuthentication] })),
];
