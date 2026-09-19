import { SEOUL_DISTRICT_NAME } from '../model/seoul-districts';

/**
 * 주소에서 서울 자치구를 알아낸다.
 *
 * 여행의 지역 목록은 광역시를 한 덩어리('서울')로만 담아서, 구 단위 통계를
 * 낼 값이 없다. 대신 이미 저장된 주소를 읽는다. 카카오 검색으로 고른 장소는
 * 주소가 정확하므로 대부분 찾아지고, 예전 여행에도 그대로 적용된다.
 *
 * 주소가 없거나 서울이 아니면 null이다. 추정해서 채우지 않는다.
 */

/** 긴 이름을 먼저 맞춘다. '중랑구'를 '중구'로 잘못 읽지 않게 한다. */
const DISTRICTS: readonly (readonly [string, string])[] = Object.entries(SEOUL_DISTRICT_NAME)
  .map(([code, name]) => [name, code] as const)
  .sort((a, b) => b[0].length - a[0].length);

export function districtCodeForAddress(address: string): string | null {
  const text = address.trim();
  if (!text) return null;
  // 서울 주소만 다룬다. 다른 시·도에도 같은 이름의 구가 있다(부산 중구 등).
  if (!text.startsWith('서울')) return null;

  for (const [name, code] of DISTRICTS) {
    if (text.includes(name)) return code;
  }
  return null;
}
