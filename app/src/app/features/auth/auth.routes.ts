import { inject } from '@angular/core';
import { Router, type Routes, type UrlTree } from '@angular/router';
import { AuthStore } from './data/auth-store';
import { environment } from '../../../environments/environment';

export async function checkAuthentication(): Promise<boolean | UrlTree> {
  if (environment.designPreview) return true;
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
    loadComponent: () => import('./feature/login/login').then((m) => m.LoginPage),
    title: '내 정보',
  },
];
