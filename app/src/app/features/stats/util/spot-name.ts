import { PROVINCE_SHORT_NAME } from '../../../shared/util/korea-regions';

/**
 * 지도 마커에 적을 이름.
 *
 * 시·도만 적으면 나주와 순천에 다녀와도 둘 다 '전남'으로 보인다. 어느
 * 마커가 어디인지 알 수 없다(2026-09-21 확인). 저장된 주소에서 시·군을
 * 읽어 적는다. 주소는 검증된 값이므로 지어내는 것이 아니다.
 *
 * 광역시는 시·도가 곧 그 도시다. '서울 강남구'에서 '강남'을 뽑으면 라벨이
 * 구 단위가 되어 시·도 집계와 어긋나므로 시·도 이름을 그대로 쓴다.
 */
const METRO = new Set(['seoul', 'busan', 'daegu', 'incheon', 'gwangju', 'daejeon', 'ulsan', 'sejong']);

/** '나주시', '담양군' 같은 토막. 앞의 시·도 표기는 건너뛴다. */
const CITY = /([가-힣]{2,10}?)(시|군)(?=\s|$)/;

/**
 * 이 코드가 광역시인지. 광역시는 시·도가 곧 행정구역이므로 이름이 시·도와
 * 같아도 '읽지 못한 것'이 아니다. 자리를 묶을 때 이 구분이 필요하다.
 */
export function isMetro(provinceCode: string): boolean {
  return METRO.has(provinceCode);
}

export function spotName(address: string, provinceCode: string): string {
  const fallback = PROVINCE_SHORT_NAME[provinceCode] ?? provinceCode;
  if (METRO.has(provinceCode)) return fallback;

  const text = address.trim();
  if (!text) return fallback;

  // 첫 토막은 시·도다('전남', '전라남도'). 그 뒤부터 시·군을 찾는다.
  const rest = text.slice(text.indexOf(' ') + 1);
  const hit = CITY.exec(rest);
  return hit ? hit[1] : fallback;
}
