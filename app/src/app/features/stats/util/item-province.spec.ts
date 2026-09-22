import { describe, expect, it } from 'vitest';
import type { TripRegion } from '../../trips/model/trip';
import { itemRegionCode, resolveRegion } from './item-province';

/** 통합 전 코드를 가진 여행 지역. 저장된 데이터는 대부분 이 모양이다. */
const OLD_GWANGJU = { id: 'r1', name: '광주', regionCode: 'gwangju-gwangju' } as unknown as TripRegion;

describe('itemRegionCode', () => {
  /*
    '광주 주말 여행'에 구례와 함평을 담으면 세 장소가 모두 여행 지역 '광주'를
    가리킨다. 여행 지역을 먼저 쓰면 전남 방문이 광주로 집계되어 전남에 색이
    칠해지지 않았다(2026-09-22 확인).
  */
  it('여행 지역과 주소가 다르면 주소를 따른다', () => {
    expect(itemRegionCode('전라남도 구례군 마산면 화엄사로 539', OLD_GWANGJU)).toBe('12_구례군');
    expect(itemRegionCode('전라남도 함평군 대동면 학야리', OLD_GWANGJU)).toBe('12_함평군');
  });

  it('주소가 여행 지역과 같으면 그 지역으로 센다', () => {
    expect(itemRegionCode('광주광역시 동구 문화전당로 38', OLD_GWANGJU)).toBe('12_동구');
  });

  it('주소를 읽지 못하면 여행 지역을 쓴다', () => {
    const yeosu = { id: 'r1', name: '여수시', regionCode: '12_여수시' } as unknown as TripRegion;
    expect(itemRegionCode('', yeosu)).toBe('12_여수시');
    expect(itemRegionCode('어딘가 이름 없는 곳', yeosu)).toBe('12_여수시');
  });

  it('주소도 지역도 없으면 분류하지 않는다', () => {
    expect(itemRegionCode('', null)).toBeNull();
  });
});

describe('resolveRegion', () => {
  it('저장된 코드로 찾는다', () => {
    const region = { id: 'r1', name: '여수시', regionCode: '12_여수시' } as unknown as TripRegion;
    expect(resolveRegion(region)?.code).toBe('12_여수시');
  });

  /*
    2026-07-01 통합 전에는 코드가 'jeonnam-yeosu' 꼴이었다. 그 코드는 지금
    목록에 없으므로 이름으로 다시 찾아야 예전 여행이 통계에 남는다.
  */
  it('옛 코드는 이름으로 다시 찾는다', () => {
    const old = { id: 'r1', name: '여수', regionCode: 'jeonnam-yeosu' } as unknown as TripRegion;
    expect(resolveRegion(old)?.code).toBe('12_여수시');
  });

  it('코드가 없으면 이름으로 찾는다', () => {
    const named = { id: 'r1', name: '강릉시', regionCode: null } as unknown as TripRegion;
    expect(resolveRegion(named)?.code).toBe('51_강릉시');
  });

  /*
    '서울'만 있으면 어느 자치구인지 알 수 없다. 그 시·도의 첫 지역을 골라
    쓰면 주소 없는 장소가 모두 강남구에 다녀온 것으로 표시된다(2026-09-22
    확인). 모르는 것은 분류되지 않음으로 남긴다.
  */
  it('시·도 이름만 있으면 분류하지 않는다', () => {
    const province = { id: 'r1', name: '전남광주통합특별시', regionCode: null } as unknown as TripRegion;
    expect(resolveRegion(province)).toBeNull();
    const seoul = { id: 'r1', name: '서울', regionCode: null } as unknown as TripRegion;
    expect(resolveRegion(seoul)).toBeNull();
  });

  it('찾지 못하면 비운다', () => {
    expect(resolveRegion(null)).toBeNull();
    expect(resolveRegion({ id: 'r1', name: '없는곳', regionCode: null } as unknown as TripRegion)).toBeNull();
  });
});
