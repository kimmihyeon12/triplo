import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { LocalStorageTripRepository, type KeyValueStorage } from './data/local-storage-trip-repository';
import { TRIP_REPOSITORY } from './data/trip-repository';
import { FixtureMapProvider } from './integrations/fixture/fixture-map-provider';
import { FixturePlaceSearch } from './integrations/fixture/fixture-place-search';
import { KakaoMapProvider } from './integrations/kakao/kakao-map-provider';
import { KakaoPlaceSearch } from './integrations/kakao/kakao-place-search';
import { MapConfig } from './integrations/map-config';
import { MAP_PROVIDER } from './integrations/map-provider';
import { PLACE_SEARCH } from './integrations/place-search';

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
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
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
    // 지도 표시와 장소 검색은 별개 어댑터다. 테스트 앱은 외부 호출 없는 픽스처를 쓴다.
    { provide: MAP_PROVIDER, useExisting: useFixture ? FixtureMapProvider : KakaoMapProvider },
    { provide: PLACE_SEARCH, useExisting: useFixture ? FixturePlaceSearch : KakaoPlaceSearch },
  ],
};
