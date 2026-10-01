import type { GeoPoint, PlaceCandidate } from '../../places/model/place';
import type { PlaceSearchProvider } from '../../places/data/place-search';
import type { PlanKind } from '../../trips/model/trip';
import { kindFromCategory, nameMatch } from './verify-places';

/**
 * AI 일정 짜기·챗봇이 고를 실제 장소 후보를 카카오 검색으로 먼저 모은다(2026-10-01).
 * 모델은 이 후보의 번호로만 고르고, 좌표·주소·분류는 검색 결과에서 가져온다.
 * 모델이 기억으로 장소를 지어 내 확인에서 빠지거나 엉뚱한 곳이 잡히던 문제를 막는다.
 */

/** 모델에게 보내는 후보. 좌표는 보내지 않는다. 동선은 area로 묶게 한다. */
export interface WireCandidate {
  readonly id: string;
  readonly name: string;
  readonly kind: PlanKind;
  readonly category: string;
  readonly area: string;
}

/** 앱이 들고 있는 후보. 답을 받은 뒤 좌표·주소·장소 ID를 붙이는 데 쓴다. */
export type HeldCandidate = PlaceCandidate & { readonly kind: PlanKind };

export interface CandidatePool {
  readonly wire: WireCandidate[];
  readonly byId: ReadonlyMap<string, HeldCandidate>;
}

export interface CandidateQuery {
  readonly query: string;
  readonly size: number;
  /** 이 검색으로 찾을 종류. 검색 분류가 식당·카페·숙박이 아니면 이 값을 쓴다. */
  readonly kind: PlanKind;
  readonly near?: GeoPoint | null;
  readonly radius?: number;
}

export const EMPTY_POOL: CandidatePool = { wire: [], byId: new Map() };

/** 주소에서 시도를 빼고 시군구·읍면동만 남긴다. 예: '강원특별자치도 강릉시 초당동 123' → '강릉시 초당동'. */
export function areaOf(address: string): string {
  const parts = address.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(1, 3)
    .filter((p) => !/\d/.test(p))
    .join(' ');
}

/** 질문 낱말 → 검색어. 정해진 표만 쓰고 모델에게 묻지 않는다. 순서는 표 순서다. */
const THEMES: readonly { words: RegExp; keyword: string; kind: PlanKind }[] = [
  { words: /맛집|먹방|밥|식당|점심|저녁|음식/, keyword: '맛집', kind: 'meal' },
  { words: /카페|디저트|빵|커피/, keyword: '카페', kind: 'break' },
  { words: /사진|뷰|전망|풍경|인생샷/, keyword: '가볼만한곳', kind: 'place' },
  { words: /야경|밤바다|밤에/, keyword: '야경', kind: 'place' },
  { words: /관광|볼거리|명소/, keyword: '관광명소', kind: 'place' },
  { words: /체험|액티비티|아이|키즈|레저/, keyword: '체험', kind: 'activity' },
  { words: /시장|쇼핑|기념품/, keyword: '시장', kind: 'shopping' },
];
const DEFAULT_THEMES = ['관광명소', '맛집', '카페'];

export function themeKeywords(text: string): string[] {
  const found = THEMES.filter((t) => t.words.test(text)).map((t) => t.keyword);
  return found.length ? found : [...DEFAULT_THEMES];
}

const kindOfKeyword = (keyword: string): PlanKind => THEMES.find((t) => t.keyword === keyword)?.kind ?? 'place';

/** 일정 짜기는 지역마다 종류별로 찾는다. 지역은 3곳까지. */
export function planQueries(
  regions: readonly string[],
  options: { dayTrip: boolean; taste: string },
): CandidateQuery[] {
  const base: { keyword: string; size: number; kind: PlanKind }[] = [
    { keyword: '관광명소', size: 15, kind: 'place' },
    { keyword: '가볼만한곳', size: 15, kind: 'place' },
    { keyword: '맛집', size: 15, kind: 'meal' },
    { keyword: '카페', size: 15, kind: 'break' },
    { keyword: '체험', size: 10, kind: 'activity' },
    { keyword: '시장', size: 10, kind: 'shopping' },
  ];
  if (!options.dayTrip) base.push({ keyword: '호텔', size: 10, kind: 'stay' }, { keyword: '펜션', size: 10, kind: 'stay' });
  // 취향에 맞는 낱말이 기본 검색에 없으면 하나 더 찾는다.
  const taste = options.taste.trim() ? themeKeywords(options.taste) : [];
  for (const keyword of taste)
    if (!base.some((b) => b.keyword === keyword)) base.push({ keyword, size: 10, kind: kindOfKeyword(keyword) });
  return regions.slice(0, 3).flatMap((region) => base.map((b) => ({ query: `${region} ${b.keyword}`, size: b.size, kind: b.kind })));
}

/** 챗봇은 질문 낱말로 최대 4번 찾는다. 지역을 모르면 찾지 않는다. */
export function chatQueries(regions: readonly string[], text: string, near: GeoPoint | null): CandidateQuery[] {
  if (!regions.length) return [];
  const keywords = themeKeywords(text);
  const queries: CandidateQuery[] = [];
  for (const region of regions.slice(0, 2))
    for (const keyword of keywords)
      queries.push({
        query: `${region} ${keyword}`,
        size: 15,
        kind: kindOfKeyword(keyword),
        ...(near ? { near, radius: 5000 } : {}),
      });
  return queries.slice(0, 4);
}

export async function gatherCandidates(
  search: PlaceSearchProvider,
  queries: readonly CandidateQuery[],
  options: { exclude: readonly string[]; max: number },
): Promise<CandidatePool> {
  const results = await Promise.all(
    queries.map(async (q) => {
      try {
        const { candidates } = await search.search(q.query, {
          size: q.size,
          ...(q.near ? { near: q.near, radius: q.radius } : {}),
        });
        return candidates.map((c) => ({ ...c, kind: kindFromCategory(c.category, q.kind) }));
      } catch {
        // 한 검색의 실패가 나머지를 막지 않게 한다.
        return [];
      }
    }),
  );
  const held: HeldCandidate[] = [];
  const known = (c: PlaceCandidate) =>
    held.some((h) => h.id === c.id || nameMatch(h.name, c.name) === 'exact') ||
    options.exclude.some((name) => nameMatch(name, c.name) === 'exact');
  // 검색마다 돌아가며 하나씩 담아 한 종류가 상한을 다 차지하지 않게 한다.
  const longest = Math.max(0, ...results.map((r) => r.length));
  for (let i = 0; i < longest && held.length < options.max; i++)
    for (const list of results) {
      const c = list[i];
      if (!c || known(c)) continue;
      held.push(c);
      if (held.length >= options.max) break;
    }
  const byId = new Map<string, HeldCandidate>();
  const wire = held.map((c, i) => {
    const id = `c${i + 1}`;
    byId.set(id, c);
    return { id, name: c.name, kind: c.kind, category: c.category, area: areaOf(c.roadAddress || c.address) };
  });
  return { wire, byId };
}
