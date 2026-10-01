import type { Provider } from '@angular/core';
import { FixtureMapProvider } from './features/places/data/fixture/fixture-map-provider';
import { FixturePlaceSearch } from './features/places/data/fixture/fixture-place-search';
import { MAP_PROVIDER } from './features/places/data/map-provider';
import { PLACE_SEARCH } from './features/places/data/place-search';
import { AI_PLAN_PROVIDER } from './features/ai-planning/data/ai-plan-provider';
import { FixtureAiProvider } from './features/ai-planning/data/fixture-ai-provider';
import { RECEIPT_SCANNER } from './features/expenses/data/receipt-scanner';
import { FixtureReceiptScanner } from './features/expenses/data/fixture-receipt-scanner';
import { CHAT_PROVIDER, FixtureChatProvider } from './features/travel-chat/travel-chat';
import { PLACE_LINK_RESOLVER } from './features/places/data/place-link-resolver';
import { FixturePlaceLinkResolver } from './features/places/data/fixture/fixture-place-link-resolver';

/** 테스트 빌드의 어댑터. 외부를 부르지 않는 고정 응답이다(adapters.ts 참고). */
export const ADAPTER_PROVIDERS: Provider[] = [
  { provide: MAP_PROVIDER, useExisting: FixtureMapProvider },
  { provide: PLACE_SEARCH, useExisting: FixturePlaceSearch },
  { provide: PLACE_LINK_RESOLVER, useExisting: FixturePlaceLinkResolver },
  { provide: AI_PLAN_PROVIDER, useExisting: FixtureAiProvider },
  { provide: CHAT_PROVIDER, useExisting: FixtureChatProvider },
  { provide: RECEIPT_SCANNER, useExisting: FixtureReceiptScanner },
];
