import { inject } from '@angular/core';
import { Router, type Routes, type UrlTree } from '@angular/router';
import { checkAuthentication } from '../auth/auth.routes';
import { AdminAccess } from './data/admin-access';

/**
 * 관리자만 들인다. 로그인 확인을 먼저 하고, 통과한 경우에만 서버에 묻는다.
 * 확인하지 못하면 막는다. 이 가드는 길을 가리는 편의이며 데이터 보호는
 * 서버의 is_admin()과 RLS가 맡는다.
 */
export async function requireAdmin(): Promise<boolean | UrlTree> {
  // inject는 첫 await 전에 모두 불러야 한다. checkAuthentication도 안에서
  // 첫 await 전에 inject를 마친다.
  const router = inject(Router);
  const access = inject(AdminAccess);
  const signedIn = await checkAuthentication();
  if (signedIn !== true) return signedIn;
  return (await access.check()) ? true : router.createUrlTree(['/account']);
}

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    canActivate: [requireAdmin],
    loadComponent: () => import('./feature/admin-home/admin-home').then((m) => m.AdminHome),
    title: '관리자',
  },
];
