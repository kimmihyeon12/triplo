import { describe, expect, it } from 'vitest';
import { chatRegions } from './chat-regions';

describe('질문에서 지역 읽기', () => {
  it('시군 이름은 행정구역 이름으로, 시도 이름은 그대로 읽는다', () => {
    expect(chatRegions('강릉으로 1박2일 카페 투어')).toEqual(['강릉시']);
    expect(chatRegions('부산에서 아이랑 비 오는 날')).toEqual(['부산']);
    expect(chatRegions('전주랑 군산 먹방')).toEqual(['전주시', '군산시']);
  });
  it('지역이 없으면 빈 목록이고 두 곳까지만 읽는다', () => {
    expect(chatRegions('카페 추천해줘')).toEqual([]);
    expect(chatRegions('강릉 속초 양양 코스')).toEqual(['강릉시', '속초시']);
  });
});
