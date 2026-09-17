import { expect, it, describe } from 'vitest';
import { createRegion } from './factories';
import { regionIdForAddress } from './region-match';

const REGIONS = [createRegion('강릉', 0, 'r1'), createRegion('속초', 1, 'r2')];

describe('regionIdForAddress', () => {
  it('주소에 들어 있는 지역으로 정한다', () => {
    expect(regionIdForAddress('강원 강릉시 창해로14번길 20-1', REGIONS)).toBe('r1');
    expect(regionIdForAddress('강원 속초시 중앙로 108', REGIONS)).toBe('r2');
  });

  it('어느 지역도 들어 있지 않으면 비운다', () => {
    expect(regionIdForAddress('서울 종로구 세종대로 1', REGIONS)).toBeNull();
  });

  it('주소가 비었으면 비운다', () => {
    expect(regionIdForAddress('', REGIONS)).toBeNull();
    expect(regionIdForAddress('   ', REGIONS)).toBeNull();
  });

  it('지역이 없으면 비운다', () => {
    expect(regionIdForAddress('강원 강릉시 창해로14번길', [])).toBeNull();
  });

  it('여러 지역이 걸리면 앞에 나오는 것을 쓴다', () => {
    // '강릉시 속초로' 같은 주소는 실제로 있을 수 있다. 먼저 나온 쪽이 그 동네다.
    expect(regionIdForAddress('강원 강릉시 속초로 10', REGIONS)).toBe('r1');
  });

  it('지역 이름에 시·군이 붙어 있어도 찾는다', () => {
    const regions = [createRegion('강릉시', 0, 'r1')];
    expect(regionIdForAddress('강원 강릉시 창해로14번길', regions)).toBe('r1');
  });
});
