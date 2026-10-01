import type { PlaceCandidate } from '../model/place';

/**
 * 링크에서 읽은 장소와 같은 곳을 카카오 검색 후보에서 고른다(2026-10-01).
 * 같은 곳이 있으면 지금 검색과 같은 출처(카카오)로 담고, 없을 때만 링크의 값으로 담는다.
 * 설계: docs/superpowers/specs/2026-10-01-place-link-import-design.md
 */

/** 같은 장소로 보는 최대 거리(m). 같은 건물의 두 제공자 좌표는 수 m 차이였다(2026-10-01). */
export const SAME_PLACE_METERS = 200;

/** 이름 비교용. 공백·기호를 빼고 소문자로 맞춘다. */
export function placeKey(name: string): string {
  return name.toLowerCase().replace(/[\s·.,()\-_/&'"]+/g, '');
}

function meters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** 이름이 맞고(한쪽이 다른 쪽을 포함) 가까운 후보 중 가장 가까운 것. 없으면 null. */
export function matchLinkedPlace(
  linked: { name: string; lat: number; lng: number },
  candidates: readonly PlaceCandidate[],
): PlaceCandidate | null {
  const key = placeKey(linked.name);
  if (!key) return null;
  let best: { candidate: PlaceCandidate; distance: number } | null = null;
  for (const candidate of candidates) {
    const other = placeKey(candidate.name);
    if (!other || !(other.includes(key) || key.includes(other))) continue;
    const distance = meters(linked, candidate);
    if (distance > SAME_PLACE_METERS) continue;
    if (!best || distance < best.distance) best = { candidate, distance };
  }
  return best?.candidate ?? null;
}
