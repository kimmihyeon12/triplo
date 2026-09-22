import type { Routes } from '@angular/router';

export const TRIPS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./feature/trip-list/trip-list').then((m) => m.TripListPage),
    title: '트립플로',
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./feature/trip-workspace/trip-workspace').then((m) => m.TripWorkspace),
    children: [
      {
        path: '',
        loadComponent: () => import('./feature/trip-form/trip-form').then((m) => m.TripFormPage),
        title: '여행 만들기',
      },
    ],
  },
  /*
    AI 일정 만들기와 대화형 탐색은 서로 다른 기능이므로 진입점을 나눈다
    (2026-09-22 사용자 결정). 조건이 정해진 사용자는 단계를 밟아 만들고,
    정하지 못한 사용자는 떠 있는 버튼으로 대화를 연다. 한쪽을 다른 쪽
    안에 넣으면 찾는 기능이 어디 있는지 알 수 없다.
  */
  {
    path: 'ai',
    loadComponent: () => import('./feature/ai-plan/ai-plan').then((m) => m.AiPlanPage),
    title: 'AI 일정 만들기',
  },
  {
    path: 'chat',
    loadChildren: () => import('../travel-chat/travel-chat.routes').then((m) => m.CHAT_ROUTES),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./feature/trip-workspace/trip-workspace').then((m) => m.TripWorkspace),
    children: [
      // 다른 기능의 화면은 그 기능이 공개한 경로로 붙인다. 내부 파일을 직접
      // 가리키면 그쪽 폴더를 정리할 때마다 여기까지 고쳐야 한다.
      {
        path: 'expenses',
        loadChildren: () => import('../expenses/expenses.routes').then((m) => m.EXPENSES_ROUTES),
      },
      {
        path: 'invite',
        loadChildren: () =>
          import('../collaboration/collaboration.routes').then((m) => m.INVITE_ROUTES),
      },
      {
        path: 'export',
        loadComponent: () =>
          import('./feature/itinerary-export/itinerary-export').then((m) => m.ItineraryExport),
      },
      {
        path: '',
        loadComponent: () =>
          import('./feature/trip-detail/trip-detail').then((m) => m.TripDetailPage),
        title: '여행 상세',
      },
      {
        path: 'edit',
        loadComponent: () => import('./feature/trip-form/trip-form').then((m) => m.TripFormPage),
        title: '여행 편집',
      },
      {
        path: 'stops/new',
        loadComponent: () => import('./feature/stop-form/stop-form').then((m) => m.StopFormPage),
        title: '장소 추가',
      },
      {
        path: 'stops/:stopId',
        loadComponent: () => import('./feature/stop-form/stop-form').then((m) => m.StopFormPage),
        title: '장소 편집',
      },
      {
        path: 'stays/new',
        loadComponent: () => import('./feature/stay-form/stay-form').then((m) => m.StayFormPage),
        title: '숙소 추가',
      },
      {
        path: 'stays/:stayId',
        loadComponent: () => import('./feature/stay-form/stay-form').then((m) => m.StayFormPage),
        title: '숙소 편집',
      },
    ],
  },
];
