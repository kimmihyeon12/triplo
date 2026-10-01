import type { PlaceCandidate, GeoPoint } from '../../places/model/place';
import type { PlaceSearchProvider } from '../../places/data/place-search';
import type { PlanKind } from '../../trips/model/trip';
import type { PACE, VerifiedItem } from '../model/ai-plan';
import { kindFromCategory, nameMatch } from './verify-places';

/**
 * 장소 확인을 거친 뒤에도 하루에 이만큼은 남게 한다(2026-10-01 사용자 결정).
 * 모델이 지시를 어기거나, 지어낸 식당이 확인에서 빠지거나, 검색 분류가 식사가 아니라서
 * 그날 밥이 하나도 남지 않은 일이 있었다. 관광에는 쇼핑·액티비티도 센다.
 */
export type Pace = (typeof PACE)[number];

export const DAY_MINIMUM: Record<Pace, { sights: number; cafe: number; meals: number }> = {
  여유롭게: { sights: 1, cafe: 1, meals: 2 },
  보통: { sights: 2, cafe: 1, meals: 2 },
  알차게: { sights: 3, cafe: 1, meals: 2 },
};

export type MissingSlot = '점심' | '저녁' | '카페' | '관광';

export interface FillResult {
  readonly items: VerifiedItem[];
  /** 검색으로도 찾지 못한 자리. 지어내지 않고 화면에 알린다. */
  readonly missing: { day: number; slot: MissingSlot }[];
}

const SIGHT_KINDS: readonly PlanKind[] = ['place', 'activity', 'shopping'];
const SIGHT_TIMES = ['10:00', '16:30', '14:00'];
const SEARCH_SIZE = 10;
/** 그날 장소에서 이만큼 안에서만 찾는다. 걸어서·차로 잠깐 갈 거리다. */
const NEAR_RADIUS = 5000;

interface Slot {
  readonly slot: MissingSlot;
  readonly kind: PlanKind;
  readonly start: string;
  readonly keyword: string;
}

/** 'HH:mm'을 분으로. 없으면 null. */
const minutes = (t: string | null) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null);

/** 그날 모자란 자리를 시각 순서로 고른다. */
function slotsFor(day: readonly VerifiedItem[], pace: string): Slot[] {
  // 모르는 값이면 보통으로 본다.
  const need = DAY_MINIMUM[pace as Pace] ?? DAY_MINIMUM['보통'];
  const slots: Slot[] = [];
  const meals = day.filter((i) => i.kind === 'meal');
  if (meals.length < need.meals) {
    // 시각이 없는 식사는 점심으로 본다. 15시 전이면 점심, 그 뒤면 저녁이다.
    const hasLunch = meals.some((m) => (minutes(m.start) ?? 0) < 15 * 60);
    const hasDinner = meals.some((m) => (minutes(m.start) ?? 0) >= 16 * 60);
    if (!hasLunch) slots.push({ slot: '점심', kind: 'meal', start: '12:00', keyword: '맛집' });
    if (!hasDinner && meals.length + slots.length < need.meals)
      slots.push({ slot: '저녁', kind: 'meal', start: '18:00', keyword: '맛집' });
  }
  if (day.filter((i) => i.kind === 'break').length < need.cafe)
    slots.push({ slot: '카페', kind: 'break', start: '15:00', keyword: '카페' });
  const sights = day.filter((i) => SIGHT_KINDS.includes(i.kind)).length;
  const taken = new Set(day.map((i) => i.start));
  const times = SIGHT_TIMES.filter((t) => !taken.has(t));
  for (let n = sights; n < need.sights; n++)
    slots.push({ slot: '관광', kind: 'place', start: times.shift() ?? '17:30', keyword: '관광명소' });
  return slots.sort((a, b) => minutes(a.start)! - minutes(b.start)!);
}

/** 그 시각에 가장 가까운 그날 장소의 좌표. 근처에서 찾아야 동선이 벌어지지 않는다. */
function anchorFor(day: readonly VerifiedItem[], start: string): GeoPoint | null {
  const at = minutes(start)!;
  let best: { point: GeoPoint; gap: number } | null = null;
  for (const i of day) {
    if (!i.location) continue;
    const gap = Math.abs((minutes(i.start) ?? at + 24 * 60) - at);
    if (!best || gap < best.gap) best = { point: i.location, gap };
  }
  return best?.point ?? null;
}

/** 검색 결과가 그 자리에 맞는 업종인지. 관광은 검색 분류가 관광·문화일 때만 쓴다. */
function fits(hit: PlaceCandidate, kind: PlanKind): boolean {
  if (kind !== 'place') return kindFromCategory(hit.category, kind) === kind;
  if (kindFromCategory(hit.category, 'place') !== 'place') return false;
  return ['관광', '명소', '문화', '공원', '전시'].some((w) => hit.category.includes(w));
}

/** 끼운 자리 앞 항목의 이동 정보는 더 맞지 않으므로 지운다. 순서는 1부터 다시 매긴다. */
function insertByTime(day: VerifiedItem[], added: VerifiedItem): VerifiedItem[] {
  const sorted = [...day].sort((a, b) => a.order - b.order);
  const at = minutes(added.start)!;
  let index = sorted.findIndex((i) => i.start !== null && minutes(i.start)! > at);
  if (index < 0) index = sorted.length;
  if (index > 0) sorted[index - 1] = { ...sorted[index - 1]!, moveToNext: null };
  sorted.splice(index, 0, added);
  return sorted.map((i, n) => ({ ...i, order: n + 1 }));
}

export async function fillDayMinimums(
  items: readonly VerifiedItem[],
  dayCount: number,
  pace: string,
  regions: readonly string[],
  search: PlaceSearchProvider,
): Promise<FillResult> {
  const all: VerifiedItem[] = [...items];
  const missing: FillResult['missing'] = [];
  const used = (hit: PlaceCandidate) =>
    all.some((i) => i.placeRef?.id === hit.id || nameMatch(i.name, hit.name) !== null);

  for (let d = 1; d <= dayCount; d++) {
    let day = all.filter((i) => i.day === d);
    for (const slot of slotsFor(day, pace)) {
      // 그날 장소가 하나도 없으면 그날의 지역 이름으로 찾는다. 지역은 고른 순서대로 날을
      // 나눠 돈다고 본다. 다른 날 좌표를 쓰면 다른 지역 근처를 찾을 수 있다.
      const near = anchorFor(day, slot.start);
      const region = regions[Math.floor(((d - 1) * regions.length) / dayCount)] ?? '';
      const query = near ? slot.keyword : `${region} ${slot.keyword}`.trim();
      let hit: PlaceCandidate | undefined;
      try {
        const { candidates } = await search.search(query, near ? { near, radius: NEAR_RADIUS, size: SEARCH_SIZE } : { size: SEARCH_SIZE });
        hit = candidates.find((c) => fits(c, slot.kind) && !used(c));
      } catch {
        // 검색이 실패해도 나머지 자리는 계속 채운다.
      }
      if (!hit) {
        missing.push({ day: d, slot: slot.slot });
        continue;
      }
      const added: VerifiedItem = {
        id: `fill-${d}-${all.length}`,
        day: d,
        order: 0,
        start: slot.start,
        moveToNext: null,
        name: hit.name,
        kind: slot.kind,
        verified: true,
        note: hit.category,
        address: hit.roadAddress || hit.address,
        location: { lat: hit.lat, lng: hit.lng },
        placeRef: { provider: hit.provider, id: hit.id, url: hit.url },
      };
      const next = insertByTime(day, added);
      const rest = all.filter((i) => i.day !== d);
      all.length = 0;
      all.push(...rest, ...next);
      day = next;
    }
  }
  return { items: all, missing };
}
