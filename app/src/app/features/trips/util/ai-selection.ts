import type { AiPlanSelection } from '../../ai-planning/model/ai-plan';
import { addDays, diffDays } from '../../../shared/util/dates';
import { createRegion, createStop, createTrip } from './factories';
import { appendStop } from './itinerary';
import { regionIdForAddress } from './region-match';
import type { Trip } from '../model/trip';

/**
 * AI 결과에서 사용자가 고른 장소를 새 여행으로 만든다. 장소 검색으로 실재를
 * 확인한 항목만 담고 그때 얻은 좌표·주소를 함께 저장한다. 확인하지 못한 이름은
 * 담지 않는다. 모델이 쓴 설명은 사실과 다를 수 있어 메모로 옮기지 않는다.
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
        kind: item.kind,
        address: item.address,
        // 지역은 검색으로 얻은 주소에서 찾는다. 사용자가 고를 필요가 없다.
        regionId: regionIdForAddress(item.address, trip.regions),
        date,
        location: item.location,
        placeRef: item.placeRef,
      }),
    );
  }
  return trip;
}
