import { describe, expect, it } from 'vitest';
import { provinceCodeForAddress } from './province-match';

describe('provinceCodeForAddress', () => {
  it.each([
    ['서울 강남구 삼성동 1', 'seoul'],
    ['서울특별시 종로구 세종대로', 'seoul'],
    ['부산 해운대구 우동', 'busan'],
    ['부산광역시 중구 남포동', 'busan'],
    ['대구 중구 동성로', 'daegu'],
    ['인천 중구 공항로', 'incheon'],
    ['광주 동구 충장로', 'gwangju'],
    ['광주광역시 서구 상무대로', 'gwangju'],
    ['대전 유성구 대학로', 'daejeon'],
    ['울산 남구 삼산로', 'ulsan'],
    ['세종특별자치시 한누리대로', 'sejong'],
    ['경기 수원시 팔달구', 'gyeonggi'],
    ['경기도 성남시 분당구', 'gyeonggi'],
    ['강원 강릉시 창해로', 'gangwon'],
    ['강원특별자치도 속초시', 'gangwon'],
    ['충북 청주시 상당구', 'chungbuk'],
    ['충청북도 제천시', 'chungbuk'],
    ['충남 천안시 동남구', 'chungnam'],
    ['전북 전주시 완산구', 'jeonbuk'],
    ['전북특별자치도 군산시', 'jeonbuk'],
    ['전남 나주시 영산동', 'jeonnam'],
    ['전라남도 여수시', 'jeonnam'],
    ['경북 경주시 첨성로', 'gyeongbuk'],
    ['경남 창원시 의창구', 'gyeongnam'],
    ['제주 제주시 연동', 'jeju'],
    ['제주특별자치도 서귀포시', 'jeju'],
  ])('%s → %s', (address, code) => {
    expect(provinceCodeForAddress(address)).toBe(code);
  });

  /*
    '광주'는 광역시이면서 경기도 광주시이기도 하다. 주소 맨 앞에 오는 이름이
    그 주소의 시·도다. '경기 광주시'는 경기이지 광주광역시가 아니다.
  */
  it('경기도 광주시는 경기로 본다', () => {
    expect(provinceCodeForAddress('경기 광주시 경안동')).toBe('gyeonggi');
    expect(provinceCodeForAddress('경기도 광주시 역동')).toBe('gyeonggi');
  });

  it('광주광역시는 광주로 본다', () => {
    expect(provinceCodeForAddress('광주 북구 용봉동')).toBe('gwangju');
  });

  it.each(['', '   ', '어딘가 모를 곳', '123-45'])('알 수 없는 주소 %s는 비운다', (address) => {
    expect(provinceCodeForAddress(address)).toBeNull();
  });

  it('앞뒤 공백이 있어도 읽는다', () => {
    expect(provinceCodeForAddress('  전남 나주시  ')).toBe('jeonnam');
  });
});
