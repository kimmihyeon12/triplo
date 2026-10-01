import { describe, expect, it } from 'vitest';
import type { PlaceCandidate } from '../model/place';
import { matchLinkedPlace, placeKey } from './match-link-place';

const linked = { name: '신가회전훠궈 수원역점', lat: 37.268625, lng: 127.0037697 };
const candidate = (name: string, lat: number, lng: number, id = name): PlaceCandidate => ({
  provider: 'kakao',
  id,
  name,
  address: '',
  roadAddress: '',
  lat,
  lng,
  category: '',
  url: null,
});

describe('링크 장소와 카카오 후보 맞추기', () => {
  it('이름 표기가 조금 달라도 가까우면 같은 곳으로 본다', () => {
    expect(placeKey('신가 회전훠궈(수원역점)')).toBe(placeKey('신가회전훠궈수원역점'));
    const hit = candidate('신가회전훠궈 수원역점', 37.2686159, 127.0037566, 'k1');
    expect(matchLinkedPlace(linked, [candidate('다른 집', 37.2686, 127.0037), hit])?.id).toBe('k1');
  });

  it('지점 이름이 빠진 후보도 가까우면 같은 곳이다', () => {
    expect(matchLinkedPlace(linked, [candidate('신가회전훠궈', 37.2687, 127.0038, 'k2')])?.id).toBe('k2');
  });

  it('같은 이름이라도 멀리 있는 다른 지점은 고르지 않는다', () => {
    // 2026-10-01 실제: 카카오 검색은 수원역점 대신 영통점(약 8km)만 돌려줬다.
    expect(matchLinkedPlace(linked, [candidate('신가회전훠궈 영통점', 37.2537, 127.0781)])).toBeNull();
    expect(matchLinkedPlace(linked, [candidate('신가회전훠궈', 37.2537, 127.0781)])).toBeNull();
  });

  it('가까워도 이름이 다르면 고르지 않는다', () => {
    expect(matchLinkedPlace(linked, [candidate('수원역 롯데몰', 37.2686, 127.0037)])).toBeNull();
  });
});
