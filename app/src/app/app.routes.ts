import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'trips' },
  { path: 'trips', loadComponent: () => import('./features/trips/trip-list-page').then((m) => m.TripListPage), title: '트립플로' },
  { path: 'trips/new', loadComponent: () => import('./features/trips/trip-form-page').then((m) => m.TripFormPage), title: '여행 만들기' },
  { path: 'trips/ai', loadComponent: () => import('./features/trips/ai-plan-page').then((m) => m.AiPlanPage), title: 'AI 일정 만들기' },
  { path: 'trips/:id', loadComponent: () => import('./features/trips/trip-detail-page').then((m) => m.TripDetailPage), title: '여행 상세' },
  { path: 'trips/:id/edit', loadComponent: () => import('./features/trips/trip-form-page').then((m) => m.TripFormPage), title: '여행 편집' },
  { path: 'trips/:id/stops/new', loadComponent: () => import('./features/trips/stop-form-page').then((m) => m.StopFormPage), title: '장소 추가' },
  { path: 'trips/:id/stops/:stopId', loadComponent: () => import('./features/trips/stop-form-page').then((m) => m.StopFormPage), title: '장소 편집' },
  { path: 'trips/:id/stays/new', loadComponent: () => import('./features/trips/stay-form-page').then((m) => m.StayFormPage), title: '숙소 추가' },
  { path: 'trips/:id/stays/:stayId', loadComponent: () => import('./features/trips/stay-form-page').then((m) => m.StayFormPage), title: '숙소 편집' },
  { path: '**', redirectTo: 'trips' },
];
