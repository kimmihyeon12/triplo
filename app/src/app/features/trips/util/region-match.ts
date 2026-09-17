import type { TripRegion } from '../model/trip';

/**
 * 장소 주소에서 여행 지역을 찾아낸다. 일정 추가 화면에서 지역을 고르게 하지 않는
 * 대신 이 계산으로 채운다. 대개 답이 하나뿐인 선택을 사용자에게 미루지 않는다.
 *
 * 주소가 없거나 어느 지역에도 걸리지 않으면 비운다. 추측하지 않는다.
 */
export function regionIdForAddress(
  address: string,
  regions: readonly TripRegion[],
): string | null {
  const text = address.trim();
  if (!text || !regions.length) return null;

  // 주소에서 먼저 나오는 지역이 그 동네다. '강릉시 속초로'는 강릉이다.
  let best: { id: string; at: number } | null = null;
  for (const region of regions) {
    const name = region.name.trim();
    if (!name) continue;
    const at = text.indexOf(name);
    if (at < 0) continue;
    if (!best || at < best.at) best = { id: region.id, at };
  }
  return best?.id ?? null;
}
