import { costRange, estimateMemo } from '../../../shared/util/plan-estimate';
import type { AiPlanSelection, PlanItem } from '../../ai-planning/model/ai-plan';
import { addDays, diffDays } from '../../../shared/util/dates';
import { createRegion, createStay, createStop, createTrip } from './factories';
import { appendStop } from './itinerary';
import { regionIdForAddress } from './region-match';
import type { Trip } from '../model/trip';

/**
 * AI 결과에서 사용자가 고른 장소를 새 여행으로 만든다. 장소 검색으로 실재를
 * 확인한 항목만 담고 그때 얻은 좌표·주소를 함께 저장한다. 확인하지 못한 이름은
 * 담지 않는다. 예상 비용·체류시간은 계획값으로 저장하고 AI 추정 표시와 계산 기준을 메모에 남긴다.
 *
 * 항목은 코스 순서대로 들어온다. 숙소는 일반 장소가 아니라 숙박으로 담는다. 체크인 날짜가
 * 필요하므로 날짜 미정 여행에는 숙소를 담지 않는다. 추천 시각은 메모에만 남기고 고정 시각으로
 * 저장하지 않는다. 이동시간은 경로시간 저장 규칙에 걸리므로 어디에도 남기지 않는다.
 */
export function selectionToTrip(selection: AiPlanSelection): Trip {
  let trip = createTrip({
    id: selection.requestId,
    title: selection.regions.length ? `${selection.regions.join('·')} 여행` : '새 여행',
    startDate: selection.startDate,
    endDate: selection.endDate,
    regions: selection.regions.map((name, i) =>
      createRegion(name, i, `${selection.requestId}:region:${i}`),
    ),
  });
  const partySize = selection.partySize ?? 1;
  const lastDay = trip.startDate && trip.endDate ? diffDays(trip.startDate, trip.endDate) + 1 : 0;
  const inTrip = (day: number) => !!trip.startDate && day >= 1 && day <= lastDay;
  /** 이어지는 같은 숙소는 한 숙박으로 합친다. 1·2일차 같은 호텔이면 2박이다. */
  const stays: { first: PlanItem; lastDay: number; cost: number | null }[] = [];

  for (const item of selection.items) {
    if (!item.verified) continue;
    if (item.kind === 'stay') {
      if (!inTrip(item.day)) continue;
      const cost = costRange(item.estimate, partySize)?.max ?? null;
      const prev = stays.at(-1);
      if (prev && prev.first.name === item.name && prev.lastDay + 1 === item.day) {
        prev.lastDay = item.day;
        prev.cost = prev.cost !== null && cost !== null ? prev.cost + cost : null;
      } else stays.push({ first: item, lastDay: item.day, cost });
      continue;
    }
    trip = appendStop(
      trip,
      createStop({
        id: `${selection.requestId}:${item.id}`,
        name: item.name,
        kind: item.kind,
        address: item.address,
        // 지역은 검색으로 얻은 주소에서 찾는다. 사용자가 고를 필요가 없다.
        regionId: regionIdForAddress(item.address, trip.regions),
        date: inTrip(item.day) ? addDays(trip.startDate!, item.day - 1) : null,
        location: item.location,
        placeRef: item.placeRef,
        estimatedCost: costRange(item.estimate, partySize)?.max ?? null,
        stayMinutes: item.estimate?.stay?.max ?? null,
        memo: estimateMemo(item.estimate, partySize, item.start),
      }),
    );
  }

  const created = stays.map(({ first, lastDay: until, cost }) =>
    createStay({
      id: `${selection.requestId}:${first.id}`,
      name: first.name,
      address: first.address,
      regionId: regionIdForAddress(first.address, trip.regions),
      checkIn: addDays(trip.startDate!, first.day - 1),
      checkOut: addDays(trip.startDate!, until),
      estimatedCost: cost,
      location: first.location,
      placeRef: first.placeRef,
      memo: estimateMemo(first.estimate, partySize),
    }),
  );
  return created.length ? { ...trip, stays: [...trip.stays, ...created] } : trip;
}
