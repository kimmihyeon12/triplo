import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { startAppUpdates } from './core/app-update';
import { startPushResync } from './features/notifications/data/push-resync';
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
import { SupabaseTripRepository } from './features/trips/data/supabase-trip-repository';
import { supabaseTripDataClient } from './features/trips/data/trip-data-client';
import { clearLegacyLocalTrips } from './features/trips/data/legacy-local-cleanup';
import { AuthStore } from './features/auth/data/auth-store';
import { NetworkActivity } from './core/network-activity';
import { LEDGER_REPOSITORY } from './features/expenses/data/ledger-repository';
import { TRIP_MEMBERS } from './features/collaboration/data/trip-members-repository';
import { LocalTripMembers } from './features/collaboration/data/local-trip-members';
import {
  SupabaseTripMembers,
  supabaseMembersDataClient,
} from './features/collaboration/data/supabase-trip-members';
import { LocalLedgerRepository } from './features/expenses/data/local-ledger-repository';
import { SupabaseLedgerRepository } from './features/expenses/data/supabase-ledger-repository';
import { supabaseLedgerDataClient } from './features/expenses/data/ledger-data-client';
import { clearLegacyLocalLedgers } from './features/expenses/data/legacy-ledger-cleanup';
import { SUPPORT_REPOSITORY } from './features/support/data/support-repository';
import { LocalSupportRepository } from './features/support/data/local-support-repository';
import { SupabaseSupportRepository } from './features/support/data/supabase-support-repository';
import { supabaseSupportDataClient } from './features/support/data/support-data-client';
import { clearLocalSupport } from './features/support/data/local-support-cleanup';
import { APP_VERSION } from './core/version';
import { MapConfig } from './features/places/data/map-config';
import { CHAT_HISTORY, LocalChatHistory, SupabaseChatHistory, supabaseChatDataClient } from './features/travel-chat/travel-chat';
import { ADAPTER_PROVIDERS } from './adapters';

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

/**
 * 기기에 남기는 계정별 기록의 열쇠를 만든다. 읽고 쓸 때마다 지금 계정을 본다.
 *
 * 예전에는 계정과 무관한 열쇠 하나(`….chat`, `….support`)를 써서 같은 기기에서 계정을
 * 바꾸면 이전 계정의 대화·문의가 보였다(2026-09-30 감리 P1-01). 그 공용 기록은 누구
 * 것인지 알 수 없으므로 계정으로 옮기지 않고 지운다. 여행을 서버로 옮길 때와 같은 기준이다.
 */
function accountKey(kind: 'chat' | 'support'): () => string {
  const auth = inject(AuthStore);
  const base = `${environment.storageKey}.${kind}`;
  try {
    localStorage.removeItem(base);
  } catch {
    // 저장소 접근이 막힌 브라우저에서도 앱은 뜬다.
  }
  return () => `${base}.${auth.user()?.id ?? 'guest'}`;
}

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
    // 상단 바 로딩이 모든 네트워크 요청을 보도록 다른 초기화보다 먼저 fetch를 감싼다.
    provideAppInitializer(() => inject(NetworkActivity).install()),
    // 브라우저용 지도 키를 먼저 읽는다. 파일이 없어도 앱은 뜬다.
    provideAppInitializer(() => inject(MapConfig).load()),
    {
      // 실행 앱은 Supabase에 저장한다(2026-09-29). 테스트 앱과 로그인 없는 미리보기는
      // 외부 서버 없이 기기 저장소를 쓴다.
      provide: TRIP_REPOSITORY,
      useFactory: () => {
        if (environment.isTest || environment.designPreview)
          return new LocalStorageTripRepository(
            new SafeLocalStorage(),
            environment.storageKey,
            environment.isTest ? `${environment.storageKey}.failSave` : null,
            environment.isTest ? `${environment.storageKey}.conflictSave` : null,
          );
        try {
          clearLegacyLocalTrips(localStorage, environment.storageKey);
        } catch {
          // 저장소 접근이 막힌 브라우저에서도 앱은 뜬다.
        }
        const auth = inject(AuthStore);
        return new SupabaseTripRepository(
          supabaseTripDataClient(() => auth.dataClient()),
          () => auth.user()?.id ?? null,
        );
      },
    },
    // 초대·합류·멤버 관리. 실행 앱은 서버 함수, 테스트·미리보기는 고정 코드의 기기 구현.
    {
      provide: TRIP_MEMBERS,
      useFactory: () => {
        if (environment.isTest || environment.designPreview)
          return new LocalTripMembers(inject(TRIP_REPOSITORY));
        const auth = inject(AuthStore);
        return new SupabaseTripMembers(supabaseMembersDataClient(() => auth.dataClient()));
      },
    },
    // 가계부도 여행과 같이 실행 앱은 Supabase에, 테스트·미리보기는 기기에 저장한다.
    {
      provide: LEDGER_REPOSITORY,
      useFactory: () => {
        if (environment.isTest || environment.designPreview)
          return new LocalLedgerRepository(new SafeLocalStorage(), environment.storageKey);
        try {
          clearLegacyLocalLedgers(localStorage, environment.storageKey);
        } catch {
          // 저장소 접근이 막힌 브라우저에서도 앱은 뜬다.
        }
        const auth = inject(AuthStore);
        return new SupabaseLedgerRepository(supabaseLedgerDataClient(() => auth.dataClient()));
      },
    },
    // 공지·문의는 실행 앱에서 서버에 저장한다(2026-10-01). 테스트 앱과 미리보기는
    // 기기 저장을 쓰고, 기기 문의는 계정마다 다른 열쇠에 둔다(감리 P1-01).
    {
      provide: SUPPORT_REPOSITORY,
      useFactory: () => {
        if (environment.isTest || environment.designPreview)
          return new LocalSupportRepository(
            new SafeLocalStorage(),
            accountKey('support'),
            environment.isTest ? `${environment.storageKey}.supportFail` : null,
          );
        try {
          // 운영자에게 간 적 없는 기기 문의는 옮기지 않고 지운다(2026-10-01 사용자 결정).
          clearLocalSupport(localStorage, environment.storageKey);
        } catch {
          // 저장소 접근이 막힌 브라우저에서도 앱은 뜬다.
        }
        const auth = inject(AuthStore);
        return new SupabaseSupportRepository(
          supabaseSupportDataClient(() => auth.dataClient()),
          APP_VERSION.name,
          () => (typeof navigator === 'undefined' ? '' : navigator.userAgent),
        );
      },
    },
    // 지도·장소 검색·AI 어댑터. 테스트 빌드는 파일째 고정 응답으로 바뀐다(adapters.ts).
    ...ADAPTER_PROVIDERS,
    // 대화 기록은 실행 앱에서 서버에 남기고 본인만 본다(2026-10-07). 기기에 남은 대화는
    // 그 계정으로 처음 열 때 서버로 옮긴다. 테스트 앱과 미리보기는 기기 저장을 쓴다.
    {
      provide: CHAT_HISTORY,
      useFactory: () => {
        const device = new LocalChatHistory(new SafeLocalStorage(), accountKey('chat'));
        if (environment.isTest || environment.designPreview) return device;
        const auth = inject(AuthStore);
        return new SupabaseChatHistory(
          supabaseChatDataClient(() => auth.dataClient()),
          device,
          () => auth.user()?.id ?? null,
        );
      },
    },
    // 설치형 앱 요건. 개발·테스트에서는 캐시가 변경을 가리므로 끈다.
    // 새 버전을 열 때·돌아올 때 확인해 반영한다(core/app-update.ts).
    provideAppInitializer(() => startAppUpdates()),
    // 서버에서 지워진 푸시 구독을 앱을 열 때 다시 맞춘다(2026-10-06 공지 미수신).
    provideAppInitializer(() => startPushResync()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode() && !environment.isTest,
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
