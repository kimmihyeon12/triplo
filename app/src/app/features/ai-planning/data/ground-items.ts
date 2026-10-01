import type { VerifiedItem } from '../model/ai-plan';
import type { AiItem } from '../util/ai-response';
import type { CandidatePool } from './place-candidates';

/**
 * 후보 번호(ref)로 답한 항목을 실제 장소에 붙인다(2026-10-01).
 * 이름·좌표·주소·장소 ID는 후보(카카오 검색 결과)에서 가져오고, 다시 검색하지 않는다.
 * 후보에 없는 번호나 번호 없이 이름만 낸 항목은 지어낸 장소일 수 있어 버린다.
 */
export function groundItems(items: readonly AiItem[], pool: CandidatePool): VerifiedItem[] {
  const out: VerifiedItem[] = [];
  items.forEach((item, index) => {
    const hit = item.ref ? pool.byId.get(item.ref) : undefined;
    if (!hit) return;
    out.push({
      id: `ai-${index}`,
      day: item.day,
      order: item.order,
      start: item.start,
      moveToNext: item.moveToNext,
      ...(item.closed ? { closed: item.closed } : {}),
      ...(item.estimate ? { estimate: item.estimate } : {}),
      name: hit.name,
      // 검색 분류는 식당·카페·숙소를 정확히 가르지만 관광·액티비티·쇼핑은 가르지 못한다.
      // 관광으로 찾은 곳을 모델이 액티비티·쇼핑으로 골랐으면 그 분류를 쓴다.
      kind: hit.kind === 'place' && (item.kind === 'activity' || item.kind === 'shopping') ? item.kind : hit.kind,
      verified: true,
      note: hit.category,
      address: hit.roadAddress || hit.address,
      location: { lat: hit.lat, lng: hit.lng },
      placeRef: { provider: hit.provider, id: hit.id, url: hit.url },
    });
  });
  return out;
}
