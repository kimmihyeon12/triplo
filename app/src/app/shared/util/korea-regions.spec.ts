import { describe, expect, it } from 'vitest';
import {
  KOREA_PROVINCES,
  KOREA_REGIONS,
  findRegionByCode,
  findRegionByName,
  provinceCodeOf,
  searchRegions,
} from './korea-regions';

describe('지역 목록', () => {
  it('2026년 기준 시·도 16개를 담는다', () => {
    // 2026-07-01에 광주광역시와 전라남도가 전남광주통합특별시로 합쳐졌다.
    expect(KOREA_PROVINCES).toHaveLength(16);
    expect(KOREA_PROVINCES.find((p) => p.code === '12')?.name).toBe('전남광주통합특별시');
    expect(KOREA_PROVINCES.some((p) => p.name === '광주광역시')).toBe(false);
    expect(KOREA_PROVINCES.some((p) => p.name === '전라남도')).toBe(false);
  });

  it('시·군·구 230개를 담는다', () => {
    expect(KOREA_REGIONS).toHaveLength(230);
  });

  it('모든 지역이 코드를 가진다', () => {
    for (const region of KOREA_REGIONS) {
      expect(region.code, `${region.name}에 코드가 없다`).toBeTruthy();
    }
  });

  it('코드가 서로 겹치지 않는다', () => {
    const codes = KOREA_REGIONS.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('모든 지역의 시·도가 목록에 있다', () => {
    const known = new Set(KOREA_PROVINCES.map((p) => p.code));
    for (const region of KOREA_REGIONS) {
      expect(known.has(region.provinceCode), `${region.name}의 시·도 ${region.provinceCode}`).toBe(true);
    }
  });
});

describe('지역 코드', () => {
  it('표시용 괄호를 코드에 넣지 않는다', () => {
    // '중구(서울)'는 화면에서 구분하려고 붙인 표기다. 집계 키에 들어가면 안 된다.
    expect(findRegionByName('중구(서울)')?.code).toBe('11_중구');
    expect(KOREA_REGIONS.every((r) => !r.code.includes('('))).toBe(true);
  });

  it('같은 지명이라도 시·도가 다르면 코드가 다르다', () => {
    // '중구'는 다섯 시·도에 있다. 코드에 시·도 번호가 있어 섞이지 않는다.
    expect(findRegionByName('중구(서울)')?.code).toBe('11_중구');
    expect(findRegionByName('중구(부산)')?.code).toBe('26_중구');
  });

  it('코드에서 시·도 번호를 얻는다', () => {
    expect(provinceCodeOf('12_여수시')).toBe('12');
    expect(provinceCodeOf('11_종로구')).toBe('11');
  });

  it('코드로 지역을 찾는다', () => {
    expect(findRegionByCode('51_강릉시')?.name).toBe('강릉시');
  });

  it('없는 코드로 찾으면 비운다', () => {
    expect(findRegionByCode('99_없는곳')).toBeNull();
  });
});

describe('이름으로 찾기', () => {
  it('행정구역 이름으로 찾는다', () => {
    const region = findRegionByName('강릉시');
    expect(region?.code).toBe('51_강릉시');
    expect(region?.provinceCode).toBe('51');
  });

  it('없는 이름으로 찾으면 비운다', () => {
    expect(findRegionByName('없는곳')).toBeNull();
    expect(findRegionByName('')).toBeNull();
  });

  /*
    여행에 저장된 지역 이름은 시·군·구만이 아니다. 시·도를 통째로 고른
    여행도 있고, 그 이름이 '전라남도'처럼 정식 명칭일 수 있다. 이때 찾지
    못하면 통계에서 미분류가 되어 '0곳인데 누적 1곳' 같은 모순이 생긴다
    (2026-09-21 확인).
  */
  it('시·도 정식 명칭으로 찾는다', () => {
    expect(findRegionByName('전남광주통합특별시')?.provinceCode).toBe('12');
    expect(findRegionByName('강원특별자치도')?.provinceCode).toBe('51');
  });

  it('시·도 짧은 이름으로 찾는다', () => {
    expect(findRegionByName('전남광주')?.provinceCode).toBe('12');
    expect(findRegionByName('경기')?.provinceCode).toBe('41');
    expect(findRegionByName('충북')?.provinceCode).toBe('43');
  });

  it('앞뒤 공백이 있어도 찾는다', () => {
    expect(findRegionByName(' 강릉시 ')?.provinceCode).toBe('51');
  });
});

describe('지역 검색', () => {
  it('접미사 없이 쳐도 찾는다', () => {
    // 사용자는 '여수'까지만 치지 '여수시'라고 치지 않는다.
    const found = searchRegions('여수');
    expect(found[0]?.code).toBe('12_여수시');
  });

  it('이름이 그 글자로 시작하는 곳을 앞에 둔다', () => {
    const found = searchRegions('강릉');
    expect(found[0]?.name).toBe('강릉시');
  });

  it('시·도 이름으로도 찾는다', () => {
    const found = searchRegions('제주');
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((r) => r.provinceCode === '50')).toBe(true);
  });

  it('빈 글자로는 찾지 않는다', () => {
    expect(searchRegions('')).toEqual([]);
    expect(searchRegions('   ')).toEqual([]);
  });

  it('개수를 제한한다', () => {
    expect(searchRegions('구', 5)).toHaveLength(5);
  });
});
