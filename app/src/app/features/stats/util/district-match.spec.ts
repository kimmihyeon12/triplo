import { describe, expect, it } from 'vitest';
import { districtCodeForAddress } from './district-match';

describe('districtCodeForAddress', () => {
  it('서울 지번 주소에서 자치구를 찾는다', () => {
    // 카카오 검색이 돌려주는 address_name 형식이다.
    expect(districtCodeForAddress('서울 강남구 역삼동 826-20')).toBe('seoul-gangnam');
    expect(districtCodeForAddress('서울 종로구 세종로 1-57')).toBe('seoul-jongno');
  });

  it('도로명 주소에서도 찾는다', () => {
    expect(districtCodeForAddress('서울 마포구 양화로 45')).toBe('seoul-mapo');
  });

  it('정식 명칭이 붙어 있어도 찾는다', () => {
    expect(districtCodeForAddress('서울특별시 서초구 서초대로 398')).toBe('seoul-seocho');
  });

  it('구 이름이 겹치는 앞글자를 구분한다', () => {
    // '강서구'와 '강남구'는 앞 두 글자가 같다. 끝까지 맞춰야 한다.
    expect(districtCodeForAddress('서울 강서구 화곡동 1')).toBe('seoul-gangseo');
    expect(districtCodeForAddress('서울 강동구 천호동 1')).toBe('seoul-gangdong');
    expect(districtCodeForAddress('서울 강북구 미아동 1')).toBe('seoul-gangbuk');
  });

  it('중구를 다른 구의 일부로 잘못 읽지 않는다', () => {
    // '중랑구'에도 '중'이 들어 있다. 더 긴 이름을 먼저 맞춘다.
    expect(districtCodeForAddress('서울 중랑구 면목동 1')).toBe('seoul-jungnang');
    expect(districtCodeForAddress('서울 중구 명동 1')).toBe('seoul-jung');
  });

  it('서울이 아닌 주소는 비운다', () => {
    expect(districtCodeForAddress('부산 해운대구 우동 1')).toBeNull();
    expect(districtCodeForAddress('경기 성남시 분당구 정자동 1')).toBeNull();
  });

  it('주소가 비었으면 비운다', () => {
    expect(districtCodeForAddress('')).toBeNull();
    expect(districtCodeForAddress('   ')).toBeNull();
  });

  it('서울이지만 구를 알 수 없으면 비운다', () => {
    expect(districtCodeForAddress('서울')).toBeNull();
  });
});
