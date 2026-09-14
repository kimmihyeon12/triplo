import type { Routes } from '@angular/router';

export const TRIPS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./feature/trip-list-page').then(m => m.TripListPage), title: '트립플로' },
  { path: 'new', loadComponent: () => import('./feature/trip-workspace').then(m => m.TripWorkspace), children: [
    { path: '', loadComponent: () => import('./feature/trip-form-page').then(m => m.TripFormPage), title: '여행 만들기' },
  ] },
  { path: 'ai', loadComponent: () => import('./feature/ai-plan-page').then(m => m.AiPlanPage), title: 'AI 일정 만들기' },
  {
    path: ':id',
    loadComponent: () => import('./feature/trip-workspace').then(m => m.TripWorkspace),
    children: [
      { path: '', loadComponent: () => import('./feature/trip-detail-page').then(m => m.TripDetailPage), title: '여행 상세' },
      { path: 'edit', loadComponent: () => import('./feature/trip-form-page').then(m => m.TripFormPage), title: '여행 편집' },
      { path: 'stops/new', loadComponent: () => import('./feature/stop-form-page').then(m => m.StopFormPage), title: '장소 추가' },
      { path: 'stops/:stopId', loadComponent: () => import('./feature/stop-form-page').then(m => m.StopFormPage), title: '장소 편집' },
      { path: 'stays/new', loadComponent: () => import('./feature/stay-form-page').then(m => m.StayFormPage), title: '숙소 추가' },
      { path: 'stays/:stayId', loadComponent: () => import('./feature/stay-form-page').then(m => m.StayFormPage), title: '숙소 편집' },
    ],
  },
];
