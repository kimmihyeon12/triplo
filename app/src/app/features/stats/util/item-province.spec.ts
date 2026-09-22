import { describe, expect, it } from 'vitest';
import type { TripRegion } from '../../trips/model/trip';
import { itemProvinceCode } from './item-province';

const GWANGJU = { id: 'r1', name: '광주', regionCode: 'gwangju', order: 0 } as unknown as TripRegion;

describe('itemProvinceCode', () => {
  /*
    '광주 주말 여행'에 구례와 함평을 담으면 세 장소가 모두 여행 지역 '광주'를
    가리킨다. 여행 지역을 먼저 쓰면 전남 방문이 광주광역시로 집계되어 전남에
    색이 칠해지지 않았다(2026-09-22 확인).
  */
  it('여행 지역과 주소가 다르면 주소를 따른다', () => {
    expect(itemProvinceCode('전라남도 구례군 마산면 화엄사로 539', GWANGJU)).toBe('jeonnam');
    expect(itemProvinceCode('전라남도 함평군 대동면 학야리', GWANGJU)).toBe('jeonnam');
  });

  it('주소가 여행 지역과 같으면 그 시·도로 센다', () => {
    expect(itemProvinceCode('광주광역시 동구 문화전당로 38', GWANGJU)).toBe('gwangju');
  });

  it('주소가 없으면 여행 지역을 쓴다', () => {
    expect(itemProvinceCode('', GWANGJU)).toBe('gwangju');
  });

  it('주소를 읽지 못하면 여행 지역을 쓴다', () => {
    expect(itemProvinceCode('어딘가 이름 없는 곳', GWANGJU)).toBe('gwangju');
  });

  it('여행 지역에 코드가 없으면 이름으로 찾는다', () => {
    const named = { id: 'r1', name: '전남', regionCode: null, order: 0 } as unknown as TripRegion;
    expect(itemProvinceCode('', named)).toBe('jeonnam');
  });

  // 시·군 코드가 담겨 있어도 전국 격자는 시·도 단위다.
  it('시·군 지역은 시·도로 올려 센다', () => {
    const gangneung = { id: 'r1', name: '강릉', regionCode: 'gangwon-gangneung', order: 0 } as unknown as TripRegion;
    expect(itemProvinceCode('', gangneung)).toBe('gangwon');
  });

  it('주소도 지역도 없으면 분류하지 않는다', () => {
    expect(itemProvinceCode('', null)).toBeNull();
  });
});
