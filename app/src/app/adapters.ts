import type { Provider } from '@angular/core';
import { KakaoMapProvider } from './features/places/data/kakao/kakao-map-provider';
import { KakaoPlaceSearch } from './features/places/data/kakao/kakao-place-search';
import { MAP_PROVIDER } from './features/places/data/map-provider';
import { PLACE_SEARCH } from './features/places/data/place-search';
import { AI_PLAN_PROVIDER } from './features/ai-planning/data/ai-plan-provider';
import { EdgeAiProvider } from './features/ai-planning/data/edge-ai-provider';
import { RECEIPT_SCANNER } from './features/expenses/data/receipt-scanner';
import { EdgeReceiptScanner } from './features/expenses/data/edge-receipt-scanner';
import { CHAT_PROVIDER, EdgeChatProvider } from './features/travel-chat/travel-chat';

/**
 * 외부 서비스에 닿는 어댑터. 테스트 빌드는 angular.json의 fileReplacements로 이 파일을
 * adapters.fixture.ts로 바꿔 외부 호출 없는 고정 응답을 쓴다.
 *
 * 전에는 app.config가 실제·고정 구현을 모두 가져와 조건으로 골라, 쓰지 않는 고정 응답과
 * 표본 데이터가 운영 초기 번들에 들어갔다(2026-09-30 감리 P3-01, 초기 번들 예산 초과).
 */
export const ADAPTER_PROVIDERS: Provider[] = [
  // 지도 표시와 장소 검색은 별개 어댑터다.
  { provide: MAP_PROVIDER, useExisting: KakaoMapProvider },
  { provide: PLACE_SEARCH, useExisting: KakaoPlaceSearch },
  // AI 일정·대화·사진 인식은 Supabase Edge Function을 거친다. 모델 키는 서버에만 있다.
  { provide: AI_PLAN_PROVIDER, useExisting: EdgeAiProvider },
  { provide: CHAT_PROVIDER, useExisting: EdgeChatProvider },
  // 사진으로 지출 입력도 같은 Edge 구성을 쓴다. 사진은 저장하지 않는다.
  { provide: RECEIPT_SCANNER, useExisting: EdgeReceiptScanner },
];
