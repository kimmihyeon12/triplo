import { costRange, estimateMemo } from '../../../shared/util/plan-estimate';
import type { AiPlanSelection } from '../../ai-planning/model/ai-plan';
import { addDays, diffDays } from '../../../shared/util/dates';
import { createRegion, createStop, createTrip } from './factories';
import { appendStop } from './itinerary';
import { regionIdForAddress } from './region-match';
import type { Trip } from '../model/trip';

/**
 * AI 결과에서 사용자가 고른 장소를 새 여행으로 만든다. 장소 검색으로 실재를
 * 확인한 항목만 담고 그때 얻은 좌표·주소를 함께 저장한다. 확인하지 못한 이름은
 * 담지 않는다. 예상 비용·체류시간은 계획값으로 저장하고 AI 추정 표시와 계산 기준을 메모에 남긴다.
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
  const lastDay = trip.startDate && trip.endDate ? diffDays(trip.startDate, trip.endDate) + 1 : 0;
  for (const item of selection.items) {
    if (!item.verified) continue;
    const date =
      trip.startDate && item.day >= 1 && item.day <= lastDay
        ? addDays(trip.startDate, item.day - 1)
        : null;
    trip = appendStop(
      trip,
      createStop({
        id: `${selection.requestId}:${item.id}`,
        name: item.name,
        // 숙소는 Task 8에서 stays로 담는다. 그 전까지는 관광으로 둔다.
        kind: item.kind === 'stay' ? 'place' : item.kind,
        address: item.address,
        // 지역은 검색으로 얻은 주소에서 찾는다. 사용자가 고를 필요가 없다.
        regionId: regionIdForAddress(item.address, trip.regions),
        date,
        location: item.location,
        placeRef: item.placeRef,
        estimatedCost: costRange(item.estimate, selection.partySize ?? 1)?.max ?? null,
        stayMinutes: item.estimate?.stay?.max ?? null,
        memo: estimateMemo(item.estimate, selection.partySize ?? 1),
      }),
    );
  }
  return trip;
}
