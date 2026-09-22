import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withRouterConfig,
  withViewTransitions,
} from '@angular/router';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import {
  LocalStorageTripRepository,
  type KeyValueStorage,
} from './features/trips/data/local-storage-trip-repository';
import { TRIP_REPOSITORY } from './features/trips/data/trip-repository';
import { SUPPORT_REPOSITORY } from './features/support/data/support-repository';
import { LocalSupportRepository } from './features/support/data/local-support-repository';
import { FixtureMapProvider } from './features/places/data/fixture/fixture-map-provider';
import { FixturePlaceSearch } from './features/places/data/fixture/fixture-place-search';
import { KakaoMapProvider } from './features/places/data/kakao/kakao-map-provider';
import { KakaoPlaceSearch } from './features/places/data/kakao/kakao-place-search';
import { MapConfig } from './features/places/data/map-config';
import { MAP_PROVIDER } from './features/places/data/map-provider';
import { PLACE_SEARCH } from './features/places/data/place-search';
import { AI_PLAN_PROVIDER } from './features/ai-planning/data/ai-plan-provider';
import { EdgeAiProvider } from './features/ai-planning/data/edge-ai-provider';
import { FixtureAiProvider } from './features/ai-planning/data/fixture-ai-provider';
import {
  CHAT_HISTORY,
  CHAT_PROVIDER,
  FixtureChatProvider,
  LocalChatHistory,
} from './features/travel-chat/travel-chat';

/** 브라우저가 localStorage 접근을 막으면 예외 대신 실패 상태로 이어지도록 감싼다. */
class SafeLocalStorage implements KeyValueStorage {
  private get store(): Storage {
    return globalThis.localStorage;
  }

  getItem(key: string): string | null {
    return this.store.getItem(key);
  }

  setItem(key: string, value: string): void {
    this.store.setItem(key, value);
  }

  removeItem(key: string): void {
    this.store.removeItem(key);
  }
}

const useFixture = environment.mapProvider === 'fixture';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
      // 화면 전환을 앱처럼 잇는다. 테스트 앱은 전환 중 조회가 흔들리지 않도록 제외한다.
      ...(environment.isTest
        ? []
        : [
            withViewTransitions({
              skipInitialTransition: true,
              // 날짜 칩처럼 같은 화면에서 쿼리만 바뀌는 이동은 깜빡임만 남기므로 건너뛴다.
              onViewTransitionCreated: ({ transition, from, to }) => {
                const path = (segments: { toString(): string }[]) =>
                  segments.map((s) => s.toString()).join('/');
                if (path(from.url) === path(to.url)) {
                  // 건너뛰면 finished가 AbortError로 거부된다. 받지 않으면
                  // 정상 동작인데도 콘솔에 오류로 찍히므로 여기서 삼킨다.
                  transition.finished.catch(() => undefined);
                  transition.skipTransition();
                }
              },
            }),
          ]),
    ),
    // 브라우저용 지도 키를 먼저 읽는다. 파일이 없어도 앱은 뜬다.
    provideAppInitializer(() => inject(MapConfig).load()),
    {
      provide: TRIP_REPOSITORY,
      useFactory: () =>
        new LocalStorageTripRepository(
          new SafeLocalStorage(),
          environment.storageKey,
          environment.isTest ? `${environment.storageKey}.failSave` : null,
        ),
    },
    // 공지·문의도 같은 자리에 둔다. 서버가 붙으면 구현만 갈아 끼운다.
    {
      provide: SUPPORT_REPOSITORY,
      useFactory: () =>
        new LocalSupportRepository(new SafeLocalStorage(), `${environment.storageKey}.support`),
    },
    // 지도 표시와 장소 검색은 별개 어댑터다. 테스트 앱은 외부 호출 없는 픽스처를 쓴다.
    { provide: MAP_PROVIDER, useExisting: useFixture ? FixtureMapProvider : KakaoMapProvider },
    { provide: PLACE_SEARCH, useExisting: useFixture ? FixturePlaceSearch : KakaoPlaceSearch },
    // AI 일정은 Supabase Edge Function을 거친다. 모델 키는 서버에만 있다.
    { provide: AI_PLAN_PROVIDER, useExisting: useFixture ? FixtureAiProvider : EdgeAiProvider },
    /*
      대화는 아직 고정 응답만 쓴다(13-A). 실제 모델을 부르는 Edge Function은
      Supabase 여행 저장이 끝난 뒤 13-B에서 붙이며, 그때 이 줄의 구현만 바뀐다.
      화면과 store는 제공자 인터페이스만 보므로 고치지 않는다.
    */
    { provide: CHAT_PROVIDER, useExisting: FixtureChatProvider },
    // 대화 기록은 기기에만 남긴다. 사진·여행 기록 기본 비공개와 같은 기준이다.
    {
      provide: CHAT_HISTORY,
      useFactory: () =>
        new LocalChatHistory(new SafeLocalStorage(), `${environment.storageKey}.chat`),
    },
    // 설치형 앱 요건. 개발·테스트에서는 캐시가 변경을 가리므로 끈다.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode() && !environment.isTest,
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
