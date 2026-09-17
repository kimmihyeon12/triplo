import type { Routes } from '@angular/router';

/**
 * 공지·문의·약관 화면의 라우트.
 *
 * 다른 feature가 화면 파일을 직접 가져오면 경계 검사가 막는다. 어느 화면이
 * 어느 주소에 붙는지는 이 feature가 정하고, 계정 라우트는 이 목록만 이어
 * 붙인다.
 */
export const SUPPORT_ROUTES: Routes = [
  {
    path: 'notices',
    loadComponent: () => import('./feature/notices/notices').then((m) => m.NoticesPage),
    title: '공지사항',
  },
  {
    path: 'inquiries',
    loadComponent: () => import('./feature/inquiries/inquiries').then((m) => m.InquiriesPage),
    title: '문의하기',
  },
  {
    path: 'inquiries/new',
    loadComponent: () =>
      import('./feature/inquiry-form/inquiry-form').then((m) => m.InquiryFormPage),
    title: '문의 보내기',
  },
  {
    path: 'privacy',
    loadComponent: () => import('./feature/policy/policy').then((m) => m.PolicyPage),
    data: { kind: 'privacy' },
    title: '개인정보 처리방침',
  },
  {
    path: 'terms',
    loadComponent: () => import('./feature/policy/policy').then((m) => m.PolicyPage),
    data: { kind: 'terms' },
    title: '이용약관',
  },
];
