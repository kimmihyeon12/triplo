import type { Provider } from '@angular/core';
import { KakaoMapProvider } from './features/places/data/kakao/kakao-map-provider';
import { KakaoPlaceSearch } from './features/places/data/kakao/kakao-place-search';
import { FixturePlaceSearch } from './features/places/data/fixture/fixture-place-search';
import { MAP_PROVIDER } from './features/places/data/map-provider';
import { NEARBY_PLACE_SEARCH, PLACE_SEARCH } from './features/places/data/place-search';
import { AI_PLAN_PROVIDER } from './features/ai-planning/data/ai-plan-provider';
import { FixtureAiProvider } from './features/ai-planning/data/fixture-ai-provider';
import { RECEIPT_SCANNER } from './features/expenses/data/receipt-scanner';
import { FixtureReceiptScanner } from './features/expenses/data/fixture-receipt-scanner';
import { CHAT_PROVIDER, FixtureChatProvider } from './features/travel-chat/travel-chat';
import { PLACE_LINK_RESOLVER } from './features/places/data/place-link-resolver';
import { FixturePlaceLinkResolver } from './features/places/data/fixture/fixture-place-link-resolver';

/**
 * 스토어 이미지 캡처 빌드의 어댑터(adapters.ts 참고). 지도와 주변 장소는 실제 카카오, 나머지는 고정 응답이다.
 * 장소 검색까지 실제로 바꾸면 고정 AI 응답의 예상 비용과 실제 장소가 섞여 금액이 어색해진다.
 */
export const ADAPTER_PROVIDERS: Provider[] = [
  { provide: MAP_PROVIDER, useExisting: KakaoMapProvider },
  { provide: PLACE_SEARCH, useExisting: FixturePlaceSearch },
  { provide: NEARBY_PLACE_SEARCH, useExisting: KakaoPlaceSearch },
  { provide: PLACE_LINK_RESOLVER, useExisting: FixturePlaceLinkResolver },
  { provide: AI_PLAN_PROVIDER, useExisting: FixtureAiProvider },
  { provide: CHAT_PROVIDER, useExisting: FixtureChatProvider },
  { provide: RECEIPT_SCANNER, useExisting: FixtureReceiptScanner },
];
