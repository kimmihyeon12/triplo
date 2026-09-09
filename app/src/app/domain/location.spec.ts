import { describe, expect, it } from 'vitest';
import { applyPlaceCandidate, clearLocation, isLocationVerified, type PlaceCandidate } from './location';
import { createStay, createStop } from './model';

const candidate: PlaceCandidate = {
  provider: 'kakao',
  id: '12345',
  name: '오죽헌',
  address: '강원 강릉시 죽헌동 201',
  roadAddress: '강원 강릉시 율곡로3139번길 24',
  lat: 37.7793,
  lng: 128.878,
  category: '문화유적',
  url: 'https://place.map.kakao.com/12345',
};

describe('location', () => {
  it('새 항목은 위치 미확인이고 location이 null이다', () => {
    const stop = createStop({ name: '카페' });
    expect(stop.location).toBeNull();
    expect(stop.placeRef).toBeNull();
    expect(stop.locationStatus).toBe('unverified');
    expect(isLocationVerified(stop)).toBe(false);
  });

  it('검색 후보를 적용하면 이름·주소·좌표·제공자 참조가 채워지고 확인됨이 된다', () => {
    const stop = applyPlaceCandidate(createStop({ name: '' }), candidate);
    expect(stop.name).toBe('오죽헌');
    expect(stop.address).toBe('강원 강릉시 율곡로3139번길 24');
    expect(stop.location).toEqual({ lat: 37.7793, lng: 128.878 });
    expect(stop.placeRef).toEqual({ provider: 'kakao', id: '12345', url: 'https://place.map.kakao.com/12345' });
    expect(stop.locationStatus).toBe('verified');
    expect(isLocationVerified(stop)).toBe(true);
  });

  it('도로명 주소가 없으면 지번 주소를 쓴다', () => {
    const stop = applyPlaceCandidate(createStop({}), { ...candidate, roadAddress: '' });
    expect(stop.address).toBe('강원 강릉시 죽헌동 201');
  });

  it('사용자가 이미 입력한 이름은 후보 적용 시 후보 이름으로 바뀐다(선택이 곧 확정)', () => {
    const stay = applyPlaceCandidate(createStay({ name: '내가 쓴 이름', checkIn: '2026-05-01', checkOut: '2026-05-02' }), candidate);
    expect(stay.name).toBe('오죽헌');
    expect(stay.locationStatus).toBe('verified');
  });

  it('위치 지우기는 좌표·참조만 제거하고 이름·주소는 보존한다', () => {
    const stop = clearLocation(applyPlaceCandidate(createStop({}), candidate));
    expect(stop.name).toBe('오죽헌');
    expect(stop.address).toBe('강원 강릉시 율곡로3139번길 24');
    expect(stop.location).toBeNull();
    expect(stop.placeRef).toBeNull();
    expect(stop.locationStatus).toBe('unverified');
  });

  it('저장된 옛 데이터(location 필드 없음)도 미확인으로 읽힌다', () => {
    const legacy = { ...createStop({ name: '옛 항목' }) } as Record<string, unknown>;
    delete legacy['location'];
    delete legacy['placeRef'];
    expect(isLocationVerified(legacy as never)).toBe(false);
  });
});
