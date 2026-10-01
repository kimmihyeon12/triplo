import type { PlaceCandidate } from '../../places/model/place';
import type { PlaceSearchProvider } from '../../places/data/place-search';
import { mapQuery } from '../../places/data/map-links';
import type { PlanKind } from '../../trips/model/trip';
import type { VerifiedItem } from '../model/ai-plan';
import type { AiItem } from '../util/ai-response';

/**
 * 확인할 항목. 챗봇 제안처럼 순서·시각·이동이 없는 입력도 받는다. 없으면 응답 순서와 미정으로 채운다.
 */
export type VerifyInput = Pick<AiItem, 'day' | 'name' | 'kind' | 'estimate'> &
  Partial<Pick<AiItem, 'order' | 'start' | 'moveToNext' | 'closed'>>;

/**
 * 모델이 낸 장소 이름을 실제 장소 검색으로 대조한다. 찾은 것만 확인된 장소로 두고
 * 좌표·주소·분류를 검색 결과에서 가져온다. 모델이 쓴 설명은 사실과 다를 때가 많아
 * 쓰지 않는다. 찾지 못한 이름은 지우지 않고 '직접 확인 필요'로 남겨 사용자가 판단한다.
 */

export type { VerifiedItem };

/** 후보를 몇 개까지 받을지. 검색은 우리가 물은 그것을 맨 앞에 두지 않는다. */
const CANDIDATE_SIZE = 5;

/** 이름 비교에 쓰는 형태로 다듬는다. 띄어쓰기·괄호·점 같은 표기 차이를 지운다. */
export function normalize(name: string): string {
  return name.replace(/[\s()[\]{}·.,-]/g, '').toLowerCase();
}

/**
 * 그 장소가 아니라 딸린 시설을 가리키는 말. 이름이 겹쳐도 좌표가 다른 곳이다.
 * '롯데월드'를 찾는데 '롯데월드 주차장'을 집으면 이름은 그대로인 채 좌표만
 * 주차장이 되어 사용자가 잘못된 줄 알 수 없다.
 */
const ANNEX = ['주차장', '주차', '매표소', '정류장', '승강장', '출구', '입구', '화장실'];

/**
 * 검색 결과가 우리가 물은 장소인지 본다.
 *
 * 'exact'  물은 이름과 같다. 가장 믿을 만하다.
 * 'partial' 물은 이름을 품고 있다. '스타벅스 강릉안목항점'은 스타벅스가 맞다.
 * null      다른 곳이다. 딸린 시설도 여기에 넣는다.
 *
 * 물은 이름이 결과를 품는 경우(예: '롯데월드 어드벤처'를 물었는데 '롯데월드'가
 * 나온 경우)도 부분 일치로 둔다. 더 넓은 범위를 가리키지만 같은 자리다.
 */
export function nameMatch(asked: string, found: string): 'exact' | 'partial' | null {
  const a = normalize(asked);
  const b = normalize(found);
  if (a === '' || b === '') return null;
  if (a === b) return 'exact';
  if (!a.includes(b) && !b.includes(a)) return null;
  // 물은 이름에 없던 말이 딸린 시설을 가리키면 그 장소가 아니다.
  const extra = b.length > a.length ? found : asked;
  if (ANNEX.some((word) => extra.includes(word) && !asked.includes(word))) return null;
  return 'partial';
}

/**
 * 가장 잘 맞는 후보를 고른다. 정확히 같은 이름이 있으면 그것을 쓰고, 없을 때만
 * 부분 일치를 쓴다. 검색은 우리가 물은 그것을 맨 앞에 두지 않으므로, 순서대로
 * 처음 걸리는 것을 집으면 딸린 시설이나 엉뚱한 지점이 확정된다.
 */
function bestMatch(asked: string, candidates: readonly PlaceCandidate[]): PlaceCandidate | null {
  let partial: PlaceCandidate | null = null;
  for (const c of candidates) {
    const match = nameMatch(asked, c.name);
    if (match === 'exact') return c;
    if (match === 'partial' && !partial) partial = c;
  }
  return partial;
}

/**
 * 검색 분류는 먹는 곳·숙박을 정확히 가르지만 관광·액티비티·쇼핑·기타는 가르지 못한다.
 * 그래서 앞의 셋은 검색을 따르고, 나머지는 모델 분류를 쓴다. 모델이 먹는 곳·숙소라고
 * 했는데 검색이 아니라고 하면 관광으로 낮춘다. 모델은 주류제조업체를 식사로 적는 일이 있다.
 */
export function kindFromCategory(category: string, fallback: PlanKind): PlanKind {
  if (category.includes('카페') || category.includes('디저트')) return 'break';
  if (category.includes('음식점') || category.includes('식당')) return 'meal';
  if (category.includes('숙박')) return 'stay';
  if (!category) return fallback;
  return fallback === 'meal' || fallback === 'break' || fallback === 'stay' ? 'place' : fallback;
}

export async function verifyPlaces(
  items: readonly VerifyInput[],
  regions: readonly string[],
  search: PlaceSearchProvider,
): Promise<VerifiedItem[]> {
  return Promise.all(items.map((item, index) => verifyOne(item, index, regions, search)));
}

/**
 * 지역마다 차례로 찾아 가장 잘 맞는 것을 고른다. 모델은 장소가 어느 지역인지
 * 알려주지 않으므로 첫 번째 지역으로 고정하면 '강릉 속초관광수산시장'처럼
 * 엉뚱한 검색어가 되어 뒤쪽 지역의 장소를 찾지 못한다.
 *
 * 정확히 맞는 것을 찾으면 더 보지 않는다. 남은 지역까지 매번 뒤지면 검색
 * 횟수만 늘고 결과는 같다.
 */
async function findPlace(
  name: string,
  regions: readonly string[],
  search: PlaceSearchProvider,
): Promise<PlaceCandidate | null> {
  // 지역이 없으면 이름만으로 한 번 찾는다.
  const scopes = regions.length > 0 ? regions : [''];
  let partial: PlaceCandidate | null = null;
  for (const region of scopes) {
    const { candidates } = await search.search(mapQuery(region, name), { size: CANDIDATE_SIZE });
    const hit = bestMatch(name, candidates);
    if (!hit) continue;
    if (normalize(hit.name) === normalize(name)) return hit;
    partial ??= hit;
  }
  return partial;
}

async function verifyOne(
  item: VerifyInput,
  index: number,
  regions: readonly string[],
  search: PlaceSearchProvider,
): Promise<VerifiedItem> {
  const base = {
    id: `ai-${index}`,
    day: item.day,
    name: item.name,
    kind: item.kind,
    order: item.order ?? index + 1,
    start: item.start ?? null,
    moveToNext: item.moveToNext ?? null,
    ...(item.closed ? { closed: item.closed } : {}),
    ...(item.estimate ? { estimate: item.estimate } : {}),
  };
  try {
    const hit = await findPlace(item.name, regions, search);
    if (hit) {
      return {
        ...base,
        // 검색 분류가 모델이 정한 종류보다 정확하다.
        kind: kindFromCategory(hit.category, item.kind),
        verified: true,
        note: hit.category,
        address: hit.roadAddress || hit.address,
        location: { lat: hit.lat, lng: hit.lng },
        placeRef: { provider: hit.provider, id: hit.id, url: hit.url },
      };
    }
  } catch {
    // 한 장소의 검색 실패가 나머지를 막지 않게 한다. 미확인으로 남긴다.
  }
  return {
    ...base,
    verified: false,
    note: '직접 확인 필요',
    address: '',
    location: null,
    placeRef: null,
  };
}

/**
 * 사용자가 적은 꼭 갈 장소를 직접 검색해, 결과에 없으면 1일차 끝에 더한다.
 * 모델은 지역 밖이거나 이름이 조금 틀린 곳을 빼 버린다(2026-09-30 '수원 신가회전훠궈' 누락 확인).
 * 사용자가 이름을 적은 곳이라 검색 첫 결과를 쓰며, 좌표·주소는 검색 결과에서만 가져온다.
 */
export async function mustGoPlaces(
  input: string,
  existing: readonly VerifiedItem[],
  search: PlaceSearchProvider,
): Promise<VerifiedItem[]> {
  const terms = input.split(/[,，·\n]/).map((t) => t.trim()).filter(Boolean).slice(0, 5);
  const added: VerifiedItem[] = [];
  const has = (hit: PlaceCandidate) =>
    [...existing, ...added].some(
      (i) => i.placeRef?.id === hit.id || nameMatch(i.name, hit.name) !== null,
    );
  let order = Math.max(0, ...existing.filter((i) => i.day === 1).map((i) => i.order));
  for (const term of terms) {
    try {
      const hit = (await search.search(term, { size: CANDIDATE_SIZE })).candidates[0];
      if (!hit || has(hit)) continue;
      added.push({
        id: `must-${added.length}`,
        day: 1,
        order: ++order,
        start: null,
        moveToNext: null,
        name: hit.name,
        kind: kindFromCategory(hit.category, 'place'),
        verified: true,
        note: hit.category,
        address: hit.roadAddress || hit.address,
        location: { lat: hit.lat, lng: hit.lng },
        placeRef: { provider: hit.provider, id: hit.id, url: hit.url },
      });
    } catch {
      // 한 곳의 검색 실패가 나머지를 막지 않게 한다.
    }
  }
  return added;
}
