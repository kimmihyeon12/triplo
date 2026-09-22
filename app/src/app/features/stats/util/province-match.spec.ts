import { describe, expect, it } from 'vitest';
import { provinceCodeForAddress, regionCodeForAddress } from './province-match';

describe('provinceCodeForAddress', () => {
  it('정식 명칭을 읽는다', () => {
    expect(provinceCodeForAddress('서울특별시 종로구 사직로 161')).toBe('11');
    expect(provinceCodeForAddress('강원특별자치도 강릉시 창해로 14')).toBe('51');
  });

  it('짧은 표기를 읽는다', () => {
    expect(provinceCodeForAddress('경기 수원시 팔달구 정조로 825')).toBe('41');
    expect(provinceCodeForAddress('충북 청주시 상당구 상당로 155')).toBe('43');
  });

  /*
    2026-07-01에 광주광역시와 전라남도가 전남광주통합특별시로 합쳐졌다.
    저장된 주소는 통합 전 표기이므로 둘 다 12로 읽어야 예전 기록이 산다.
  */
  it('통합 전 광주·전남 표기를 통합특별시로 읽는다', () => {
    expect(provinceCodeForAddress('광주광역시 동구 문화전당로 38')).toBe('12');
    expect(provinceCodeForAddress('전라남도 구례군 마산면 화엄사로 539')).toBe('12');
    expect(provinceCodeForAddress('전남 함평군 대동면 학야리')).toBe('12');
    expect(provinceCodeForAddress('전남광주통합특별시 여수시 오동도로 222')).toBe('12');
  });

  it('개칭 전 도 이름도 읽는다', () => {
    expect(provinceCodeForAddress('전라북도 전주시 완산구 어진길 29')).toBe('52');
    expect(provinceCodeForAddress('강원도 속초시 해오름로 186')).toBe('51');
  });

  it('경기도 광주시를 통합특별시로 읽지 않는다', () => {
    // '경기'가 먼저 맞아 '광주' 규칙까지 내려가지 않는다.
    expect(provinceCodeForAddress('경기도 광주시 경안로 33')).toBe('41');
    expect(provinceCodeForAddress('경기 광주시 초월읍')).toBe('41');
  });

  it('앞뒤 공백이 있어도 읽는다', () => {
    expect(provinceCodeForAddress('  서울 강남구 테헤란로 152  ')).toBe('11');
  });

  it.each(['', '   ', '어딘가 모를 곳', '123-45'])('읽을 수 없는 주소 %s는 비운다', (address) => {
    expect(provinceCodeForAddress(address)).toBeNull();
  });
});

describe('regionCodeForAddress', () => {
  it('시·군·구까지 읽는다', () => {
    expect(regionCodeForAddress('전라남도 구례군 마산면 화엄사로 539')).toBe('12_구례군');
    expect(regionCodeForAddress('전남 함평군 대동면 학야리')).toBe('12_함평군');
    expect(regionCodeForAddress('광주광역시 동구 문화전당로 38')).toBe('12_동구');
    expect(regionCodeForAddress('서울특별시 종로구 사직로 161')).toBe('11_종로구');
  });

  it('같은 이름이라도 시·도에 맞는 곳을 고른다', () => {
    // '중구'는 다섯 시·도에 있다. 앞의 시·도가 어디인지를 정한다.
    expect(regionCodeForAddress('서울특별시 중구 세종대로 110')).toBe('11_중구');
    expect(regionCodeForAddress('부산광역시 중구 중앙대로 120')).toBe('26_중구');
    expect(regionCodeForAddress('대구광역시 중구 공평로 88')).toBe('27_중구');
  });

  it('긴 이름을 먼저 맞춘다', () => {
    // '중랑구'를 '중구'로 잘못 읽으면 안 된다.
    expect(regionCodeForAddress('서울특별시 중랑구 봉화산로 179')).toBe('11_중랑구');
  });

  /*
    수원·성남처럼 일반구가 있는 시는 시 단위로 센다. 사용자는 "수원 다녀왔다"
    라고 하지 "수원 팔달구"라고 하지 않는다.
  */
  it('일반구가 붙은 주소는 시에서 멈춘다', () => {
    expect(regionCodeForAddress('경기 수원시 팔달구 정조로 825')).toBe('41_수원시');
    expect(regionCodeForAddress('경기도 성남시 분당구 판교역로 235')).toBe('41_성남시');
    expect(regionCodeForAddress('경상남도 창원시 의창구 중앙대로 151')).toBe('48_창원시');
  });

  it('접미사가 빠진 옛 표기도 읽는다', () => {
    expect(regionCodeForAddress('전남 여수 종화동 458')).toBe('12_여수시');
  });

  it('시·도만 있으면 비운다', () => {
    expect(regionCodeForAddress('서울특별시')).toBeNull();
  });

  it('읽을 수 없으면 비운다', () => {
    expect(regionCodeForAddress('')).toBeNull();
    expect(regionCodeForAddress('어딘가 이름 없는 곳')).toBeNull();
  });
});
