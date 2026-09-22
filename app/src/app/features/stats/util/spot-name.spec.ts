import { describe, expect, it } from 'vitest';
import { spotName } from './spot-name';

describe('spotName', () => {
  it.each([
    ['전남 나주시 영산동 1', '나주'],
    ['전라남도 순천시 대대동', '순천'],
    ['강원 강릉시 창해로 14', '강릉'],
    ['경기 수원시 팔달구 1', '수원'],
    ['경북 경주시 첨성로', '경주'],
    ['충남 천안시 동남구', '천안'],
  ])('%s → %s', (address, name) => {
    expect(spotName(address, 'jeonnam')).toBe(name);
  });

  it('군도 읽는다', () => {
    expect(spotName('전남 담양군 담양읍', 'jeonnam')).toBe('담양');
    expect(spotName('강원 양양군 강현면', 'gangwon')).toBe('양양');
  });

  /*
    광역시는 시·도가 곧 그 도시다. '서울 강남구'에서 '강남'을 뽑으면 라벨이
    구 단위가 되어 시·도 집계와 어긋난다. 광역시는 시·도 이름을 쓴다.
  */
  it.each([
    ['서울 강남구 삼성동', 'seoul', '서울'],
    ['부산 해운대구 우동', 'busan', '부산'],
    ['광주 동구 충장로', 'gwangju', '광주'],
    ['세종특별자치시 한누리대로', 'sejong', '세종'],
  ])('광역시 %s는 시·도 이름을 쓴다', (address, code, expected) => {
    expect(spotName(address, code)).toBe(expected);
  });

  it('읽을 수 없으면 시·도 이름으로 되돌아간다', () => {
    expect(spotName('', 'jeonnam')).toBe('전남');
    expect(spotName('어딘가 모를 곳', 'jeonnam')).toBe('전남');
  });

  it('모르는 시·도 코드는 그대로 둔다', () => {
    expect(spotName('', 'nowhere')).toBe('nowhere');
  });
});
