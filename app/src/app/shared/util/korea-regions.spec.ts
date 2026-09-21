import { describe, expect, it } from 'vitest';
import {
  KOREA_REGIONS,
  findRegionByCode,
  findRegionByName,
  provinceCodeOf,
} from './korea-regions';

describe('지역 코드', () => {
  it('모든 지역이 코드를 가진다', () => {
    for (const region of KOREA_REGIONS) {
      expect(region.code, `${region.name}에 코드가 없다`).toBeTruthy();
    }
  });

  it('코드가 서로 겹치지 않는다', () => {
    const codes = KOREA_REGIONS.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('표시용 괄호를 코드에 넣지 않는다', () => {
    // '광주(경기)'는 화면에서 구분하려고 붙인 표기다. 집계 키에 들어가면 안 된다.
    const gwangju = findRegionByName('광주(경기)');
    expect(gwangju?.code).toBe('gyeonggi-gwangju');
    expect(KOREA_REGIONS.every((r) => !r.code.includes('('))).toBe(true);
  });

  it('같은 지명이라도 시·도가 다르면 코드가 다르다', () => {
    expect(findRegionByName('광주')?.code).toBe('gwangju-gwangju');
    expect(findRegionByName('광주(경기)')?.code).toBe('gyeonggi-gwangju');
  });

  it('코드에서 시·도 코드를 얻는다', () => {
    expect(provinceCodeOf('gangwon-gangneung')).toBe('gangwon');
    expect(provinceCodeOf('seoul-seoul')).toBe('seoul');
  });

  it('코드로 지역을 찾는다', () => {
    expect(findRegionByCode('gangwon-gangneung')?.name).toBe('강릉');
  });

  it('없는 코드로 찾으면 비운다', () => {
    expect(findRegionByCode('nowhere-here')).toBeNull();
  });

  it('이름으로 지역을 찾는다', () => {
    const region = findRegionByName('강릉');
    expect(region?.code).toBe('gangwon-gangneung');
    expect(region?.provinceCode).toBe('gangwon');
  });

  it('없는 이름으로 찾으면 비운다', () => {
    expect(findRegionByName('없는곳')).toBeNull();
    expect(findRegionByName('')).toBeNull();
  });

  /*
    여행에 저장된 지역 이름은 시·군만이 아니다. 광역시·도를 통째로 고른
    여행도 있고, 그 이름이 '광주광역시'처럼 정식 명칭일 수 있다. 이때
    찾지 못하면 통계에서 미분류가 되어 '0곳인데 누적 1곳' 같은 모순이
    생긴다(2026-09-21 확인).
  */
  it('시·도 정식 명칭으로 찾는다', () => {
    expect(findRegionByName('광주광역시')?.provinceCode).toBe('gwangju');
    expect(findRegionByName('전라남도')?.provinceCode).toBe('jeonnam');
    expect(findRegionByName('강원특별자치도')?.provinceCode).toBe('gangwon');
  });

  it('시·도 짧은 이름으로 찾는다', () => {
    expect(findRegionByName('전남')?.provinceCode).toBe('jeonnam');
    expect(findRegionByName('경기')?.provinceCode).toBe('gyeonggi');
    expect(findRegionByName('충북')?.provinceCode).toBe('chungbuk');
  });

  it('시·군 이름이 시·도 이름보다 우선한다', () => {
    // '광주'는 광주광역시이면서 경기도 광주시이기도 하다. 광역시를 쓴다.
    expect(findRegionByName('광주')?.provinceCode).toBe('gwangju');
  });

  it('앞뒤 공백이 있어도 찾는다', () => {
    expect(findRegionByName(' 광주광역시 ')?.provinceCode).toBe('gwangju');
  });
});
