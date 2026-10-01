import { Injectable } from '@angular/core';
import type { PlanEstimate } from '../../../shared/model/plan-estimate';
import type { AiItem } from '../util/ai-response';
import type { AiPlanAvailability, AiPlanProvider, AiPlanRequest } from './ai-plan-provider';

/**
 * 테스트용 제공자. 외부를 부르지 않고 정해진 결과를 돌려준다.
 * 화면의 기다림·성공·실패·취소를 실제 LLM 없이 확인하기 위한 것이며,
 * 런타임 앱에서는 사용하지 않는다.
 */

/**
 * 픽스처 장소 검색에 있는 이름으로 짠 2일 코스. '없는장소테스트'는 일부러 찾지 못하게 두어
 * 확인 실패로 빠진 자리 앞뒤의 이동이 직선거리만 보이는지 검증한다. 금액·체류시간은 가상 값이다.
 */
const estimate = (
  min: number,
  max: number,
  basis: 'person' | 'group' | 'room_night',
  assumption: string,
  stay: readonly [number, number] | null,
): PlanEstimate => ({
  cost: { min, max, basis, quantity: 1, assumption },
  stay: stay && { min: stay[0], max: stay[1], reason: '테스트용 체류시간 예시' },
});

const FIXTURE_ITEMS: readonly AiItem[] = [
  { day: 1, order: 1, start: '10:00', moveToNext: { mode: '도보', minutes: 15 }, name: '안목해변', kind: 'activity', estimate: estimate(0, 0, 'group', '테스트용 무료 예시', [60, 90]) },
  { day: 1, order: 2, start: '12:00', moveToNext: { mode: '자가용', minutes: 20 }, name: '오죽헌', kind: 'place', closed: { onDay: true, note: '테스트용 매주 목요일 휴무 예시' }, estimate: { cost: { min: 3000, max: 5000, basis: 'person', quantity: 1, assumption: '테스트용 입장료 예시' }, stay: { min: 60, max: 90, reason: '테스트용 관람시간 예시' } } },
  { day: 1, order: 3, start: '14:00', moveToNext: null, name: '없는장소테스트', kind: 'place' },
  { day: 1, order: 4, start: '20:00', moveToNext: null, name: '강릉 테스트 호텔', kind: 'stay', estimate: estimate(90000, 120000, 'room_night', '테스트용 2인 1실 1박 예시', null) },
  { day: 2, order: 1, start: '11:00', moveToNext: null, name: '속초관광수산시장', kind: 'shopping' },
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
    const items = FIXTURE_ITEMS.filter((item) => item.day <= request.dayCount);
    // 실제 모델처럼 후보를 받으면 같은 이름의 후보 번호로 답한다. 후보에 없는 이름은 번호 없이
    // 남겨 앱이 버리는지 확인하게 한다('없는장소테스트').
    const candidates = request.candidates ?? [];
    if (!candidates.length) return items;
    return items.map((item) => {
      const hit = candidates.find((c) => c.name === item.name);
      return hit ? { ...item, ref: hit.id } : item;
    });
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
