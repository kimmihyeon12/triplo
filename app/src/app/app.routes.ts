import type { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'trips' },
  { path: 'login', loadComponent: () => import('./features/auth/feature/login-page').then(m => m.LoginPage), title: '로그인' },
  { path: 'trips', loadChildren: () => import('./features/trips/trips.routes').then(m => m.TRIPS_ROUTES) },
  { path: '**', redirectTo: 'trips' },
];
