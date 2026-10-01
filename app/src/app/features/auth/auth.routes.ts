import { inject } from '@angular/core';
import { Router, type Routes, type UrlTree } from '@angular/router';
import { AuthStore } from './data/auth-store';
import { SUPPORT_ROUTES } from '../support/support.routes';
import { NOTIFICATION_ROUTES } from '../notifications/notifications.routes';
import { GUIDE_ROUTES } from '../guide/guide.routes';
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

/** 같은 접속에서 사용법을 이미 띄웠는지. 본 표시 저장에 실패해도 다시 띄우지 않는다. */
let guideOffered = false;

/**
 * 사용법을 아직 보지 않은 사람은 여행 목록 전에 한 번 본다(2026-10-01 사용자 지적).
 * 닉네임을 이미 정한 계정(기존 계정, 다른 기기에서 가입)은 닉네임 화면을 거치지 않아 사용법을 못 봤다.
 * 여행 목록(/trips)으로 들어올 때만 보낸다. 초대 링크·공유한 여행 주소로 바로 들어온 경우는 막지 않는다.
 */
export async function offerGuide(url: string): Promise<boolean | UrlTree> {
  if (environment.designPreview || url !== '/trips') return true;
  if (sessionStorage.getItem('tc.preview.v1') === '1') return true;
  const auth = inject(AuthStore);
  const router = inject(Router);
  await auth.initialize();
  if (!auth.user() || !auth.nickname() || auth.guideSeen() || guideOffered) return true;
  guideOffered = true;
  return router.createUrlTree(['/account/guide'], { queryParams: { first: 1 } });
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
  ...NOTIFICATION_ROUTES.map((route) => ({ ...route, canActivate: [checkAuthentication] })),
  ...GUIDE_ROUTES.map((route) => ({ ...route, canActivate: [checkAuthentication] })),
];
