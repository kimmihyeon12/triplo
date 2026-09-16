import { describe, expect, it } from 'vitest';
import { KOREA_REGIONS, searchRegions } from './korea-regions';

describe('korea-regions', () => {
  it('빈 검색어에는 아무것도 돌려주지 않는다', () => {
    expect(searchRegions('')).toEqual([]);
    expect(searchRegions('   ')).toEqual([]);
  });

  it('지명이 그 글자로 시작하는 곳만 앞에 놓는다', () => {
    // 도 이름이 '강원'이라는 이유로 딸려 온 춘천·원주는 앞을 차지하지 않고,
    // 구분용 괄호에 '강원'이 든 '고성(강원)'도 마찬가지다.
    expect(searchRegions('강', 3).map((r) => r.name)).toEqual(['강화', '강릉', '강진']);
  });

  it('지명 안에 든 글자도 찾는다', () => {
    expect(searchRegions('천', 30).map((r) => r.name)).toEqual(
      expect.arrayContaining(['천안', '춘천', '이천']),
    );
  });

  it('도 이름으로 그 안의 시·군을 찾는다', () => {
    const found = searchRegions('제주', 10);
    expect(found.map((r) => r.name)).toEqual(expect.arrayContaining(['제주', '서귀포']));
  });

  it('두 글자 약칭으로도 그 도의 시·군을 찾는다', () => {
    expect(searchRegions('충북', 30).map((r) => r.name)).toEqual(
      expect.arrayContaining(['청주', '제천']),
    );
  });

  it('긴 도 이름에는 짧은 표기를 함께 담는다', () => {
    const gangneung = KOREA_REGIONS.find((r) => r.name === '강릉');
    expect(gangneung?.province).toBe('강원특별자치도');
    expect(gangneung?.short).toBe('강원');
  });

  it('같은 이름이 여러 도에 있으면 상위 지역을 붙여 구분한다', () => {
    const found = searchRegions('고성', 10);
    expect(found.map((r) => r.name)).toEqual(
      expect.arrayContaining(['고성(강원)', '고성(경남)']),
    );
    expect(searchRegions('광주', 10).map((r) => r.name)).toEqual(
      expect.arrayContaining(['광주', '광주(경기)']),
    );
  });

  it('찾는 지역이 없으면 빈 목록을 돌려준다', () => {
    expect(searchRegions('도쿄')).toEqual([]);
  });

  it('limit보다 많이 돌려주지 않는다', () => {
    expect(searchRegions('시', 3).length).toBeLessThanOrEqual(3);
  });

  it('표시 이름이 겹치지 않는다', () => {
    const names = KOREA_REGIONS.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
