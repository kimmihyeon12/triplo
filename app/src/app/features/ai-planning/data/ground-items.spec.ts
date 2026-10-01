import { describe, expect, it } from 'vitest';
import type { AiItem } from '../util/ai-response';
import type { CandidatePool, HeldCandidate } from './place-candidates';
import { groundItems } from './ground-items';

function held(name: string, kind: HeldCandidate['kind'], category = '관광명소'): HeldCandidate {
  return { provider: 'kakao', id: `k-${name}`, name, address: '강원 강릉시 저동', roadAddress: '강원 강릉시 경포로 365', lat: 37.79, lng: 128.9, category, url: `https://place.map.kakao.com/k-${name}`, kind };
}
const pool: CandidatePool = {
  wire: [],
  byId: new Map([
    ['c1', held('경포대', 'place')],
    ['c2', held('초당순두부마을', 'meal', '음식점')],
    ['c3', held('바다레일바이크', 'place')],
  ]),
};
const ai = (partial: Partial<AiItem> & { name: string }): AiItem => ({ day: 1, order: 1, start: '10:00', moveToNext: null, kind: 'place', ...partial });

describe('후보 번호로 답을 실제 장소에 붙이기', () => {
  it('ref가 맞는 항목에 후보의 이름·좌표·주소·장소 ID·분류를 붙인다', () => {
    const [item] = groundItems([ai({ ref: 'c2', name: '아무이름', kind: 'place', start: '12:00' })], pool);
    expect(item).toMatchObject({
      name: '초당순두부마을', kind: 'meal', verified: true, note: '음식점', address: '강원 강릉시 경포로 365',
      location: { lat: 37.79, lng: 128.9 }, placeRef: { provider: 'kakao', id: 'k-초당순두부마을' }, start: '12:00',
    });
  });
  it('후보에 없거나 ref가 없는 항목은 버린다', () => {
    const items = groundItems([ai({ ref: 'c9', name: '없는곳' }), ai({ name: '지어낸곳' }), ai({ ref: 'c1', name: '경포대' })], pool);
    expect(items.map((i) => i.name)).toEqual(['경포대']);
  });
  it('관광으로 찾은 후보를 모델이 액티비티·쇼핑으로 고르면 그 분류를 쓴다', () => {
    const [item] = groundItems([ai({ ref: 'c3', name: '바다레일바이크', kind: 'activity' })], pool);
    expect(item!.kind).toBe('activity');
  });
  it('식당·카페·숙소는 검색 분류를 따른다', () => {
    const [item] = groundItems([ai({ ref: 'c2', name: '초당순두부마을', kind: 'shopping' })], pool);
    expect(item!.kind).toBe('meal');
  });
});
