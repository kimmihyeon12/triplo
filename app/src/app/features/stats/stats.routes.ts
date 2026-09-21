import type { Routes } from '@angular/router';

export const STATS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./feature/visit-map/visit-map').then((m) => m.VisitMapPage),
    title: '방문 통계',
  },
  {
    path: 'details',
    loadComponent: () => import('./feature/stats/stats').then((m) => m.StatsPage),
    title: '방문 통계',
  },
];
