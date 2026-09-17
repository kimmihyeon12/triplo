import { Injectable } from '@angular/core';
import type { AiItem } from '../util/ai-response';
import type { AiPlanAvailability, AiPlanProvider, AiPlanRequest } from './ai-plan-provider';

/**
 * 테스트용 제공자. 외부를 부르지 않고 정해진 결과를 돌려준다.
 * 화면의 기다림·성공·실패·취소를 실제 LLM 없이 확인하기 위한 것이며,
 * 런타임 앱에서는 사용하지 않는다.
 */

/**
 * 앞 세 개는 픽스처 장소 검색에 있는 이름이라 '위치 확인됨'이 되고,
 * 마지막 하나는 일부러 없는 이름을 두어 '직접 확인 필요' 경로를 검증한다.
 */
const FIXTURE_ITEMS: readonly AiItem[] = [
  { day: 1, name: '안목해변', kind: 'place' },
  { day: 1, name: '오죽헌', kind: 'place' },
  { day: 2, name: '속초관광수산시장', kind: 'meal' },
  { day: 2, name: '없는장소테스트', kind: 'place' },
];

/** 테스트에서 실패·지연을 흉내 내기 위한 값. 테스트 앱에서만 설정한다. */
const FAIL_FLAG = 'tc.test.aiFail';
const DELAY_FLAG = 'tc.test.aiDelayMs';

@Injectable({ providedIn: 'root' })
export class FixtureAiProvider implements AiPlanProvider {
  async availability(): Promise<AiPlanAvailability> {
    return { available: true, reason: null };
  }

  async generate(request: AiPlanRequest, signal: AbortSignal): Promise<readonly AiItem[]> {
    const delay = Number(localStorage.getItem(DELAY_FLAG) ?? 0);
    if (delay > 0) await waitOrAbort(delay, signal);
    if (localStorage.getItem(FAIL_FLAG) === '1')
      throw new Error('AI 서버에 연결하지 못했습니다.');
    return FIXTURE_ITEMS.filter((item) => item.day <= request.dayCount);
  }
}

/** 기다리는 동안 취소를 누르면 바로 멈춘다. */
function waitOrAbort(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      clearTimeout(timer);
      reject(new DOMException('중단됨', 'AbortError'));
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
