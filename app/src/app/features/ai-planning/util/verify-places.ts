import type { GeoPoint, PlaceRef } from '../../places/model/place';
import type { PlaceSearchProvider } from '../../places/data/place-search';
import { mapQuery } from '../../places/data/map-links';
import type { StopKind } from '../../trips/model/trip';
import type { AiItem } from './ai-response';

/**
 * 모델이 낸 장소 이름을 실제 장소 검색으로 대조한다. 찾은 것만 확인된 장소로 두고
 * 좌표·주소·분류를 검색 결과에서 가져온다. 모델이 쓴 설명은 사실과 다를 때가 많아
 * 쓰지 않는다. 찾지 못한 이름은 지우지 않고 '직접 확인 필요'로 남겨 사용자가 판단한다.
 */

export interface VerifiedItem {
  readonly id: string;
  readonly day: number;
  readonly name: string;
  readonly kind: StopKind;
  /** 검색으로 실재를 확인했는지. 확인한 항목만 기본 선택 대상이다. */
  readonly verified: boolean;
  /** 검색 결과의 분류. 모델이 지어낸 설명을 쓰지 않는다. */
  readonly note: string;
  readonly address: string;
  readonly location: GeoPoint | null;
  readonly placeRef: PlaceRef | null;
}

/** 후보를 몇 개까지 받을지. 검색은 우리가 물은 그것을 맨 앞에 두지 않는다. */
const CANDIDATE_SIZE = 5;

/** 이름 비교에 쓰는 형태로 다듬는다. 띄어쓰기·괄호·점 같은 표기 차이를 지운다. */
function normalize(name: string): string {
  return name.replace(/[\s()[\]{}·.,-]/g, '').toLowerCase();
}

/**
 * 검색 결과가 우리가 물은 장소인지 본다. 한쪽 이름이 다른 쪽에 통째로 들어 있으면
 * 같은 곳으로 본다. '롯데월드'와 '롯데월드 어드벤처'는 같지만, '자이언트디거'와
 * '중국성 서초점'은 다르다. 이 확인이 없으면 검색이 돌려준 가장 비슷한 가게가
 * 엉뚱한 동네에서 확정 장소로 들어온다.
 */
function sameName(asked: string, found: string): boolean {
  const a = normalize(asked);
  const b = normalize(found);
  if (a === '' || b === '') return false;
  return a.includes(b) || b.includes(a);
}

/**
 * 검색 분류로 종류를 다시 정한다. 모델은 주류제조업체를 식사로, 음식점을 카페로
 * 적는 일이 있다. 검색이 돌려준 분류가 더 정확하다.
 */
function kindFromCategory(category: string, fallback: StopKind): StopKind {
  if (!category) return fallback;
  if (category.includes('카페') || category.includes('디저트')) return 'break';
  if (category.includes('음식점') || category.includes('식당')) return 'meal';
  // 먹는 곳으로 볼 수 없는 분류면 장소로 둔다.
  return 'place';
}

export async function verifyPlaces(
  items: readonly AiItem[],
  regions: readonly string[],
  search: PlaceSearchProvider,
): Promise<VerifiedItem[]> {
  const region = regions[0] ?? '';
  return Promise.all(items.map((item, index) => verifyOne(item, index, region, search)));
}

async function verifyOne(
  item: AiItem,
  index: number,
  region: string,
  search: PlaceSearchProvider,
): Promise<VerifiedItem> {
  const base = {
    id: `ai-${index}`,
    day: item.day,
    name: item.name,
    kind: item.kind,
  };
  try {
    // 지역을 앞에 붙여야 동명 장소가 섞이지 않는다. 예: '강릉 중앙시장'
    const { candidates } = await search.search(mapQuery(region, item.name), {
      size: CANDIDATE_SIZE,
    });
    // 이름이 실제로 맞는 후보만 고른다. 첫 번째 후보를 그대로 믿으면
    // 모델이 낸 이름과 아무 관계 없는 가게가 확정 장소로 들어온다.
    const hit = candidates.find((c) => sameName(item.name, c.name));
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
