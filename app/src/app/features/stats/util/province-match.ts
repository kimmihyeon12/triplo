/**
 * 주소에서 시·도 코드를 읽는다.
 *
 * 여행에 담은 지역과 장소의 실제 위치가 다를 수 있다. 광주 여행에 나주
 * 장소를 넣으면 여행 지역 목록에는 나주가 없어 지역이 비고, 그 장소는
 * 통계에서 조용히 빠진다(2026-09-21 확인). 저장된 주소는 검증된 값이므로
 * 그것을 읽어 채운다. 없는 값을 지어내지 않는다.
 *
 * 주소가 없거나 어느 시·도로도 읽히지 않으면 null이다.
 */

/**
 * 주소 앞머리에 오는 시·도 표기와 코드.
 *
 * 정식 명칭을 짧은 이름보다 먼저 둔다. '광주광역시'를 '광주'로 먼저 맞추면
 * 뒤에 오는 글자를 놓친다. 같은 이유로 긴 표기부터 비교한다.
 */
const PROVINCE_PREFIX: readonly (readonly [string, string])[] = [
  ['서울특별시', 'seoul'],
  ['부산광역시', 'busan'],
  ['대구광역시', 'daegu'],
  ['인천광역시', 'incheon'],
  ['광주광역시', 'gwangju'],
  ['대전광역시', 'daejeon'],
  ['울산광역시', 'ulsan'],
  ['세종특별자치시', 'sejong'],
  ['강원특별자치도', 'gangwon'],
  ['전북특별자치도', 'jeonbuk'],
  ['제주특별자치도', 'jeju'],
  ['충청북도', 'chungbuk'],
  ['충청남도', 'chungnam'],
  ['전라북도', 'jeonbuk'],
  ['전라남도', 'jeonnam'],
  ['경상북도', 'gyeongbuk'],
  ['경상남도', 'gyeongnam'],
  ['경기도', 'gyeonggi'],
  ['강원도', 'gangwon'],
  ['제주도', 'jeju'],
  ['서울', 'seoul'],
  ['부산', 'busan'],
  ['대구', 'daegu'],
  ['인천', 'incheon'],
  ['대전', 'daejeon'],
  ['울산', 'ulsan'],
  ['세종', 'sejong'],
  ['경기', 'gyeonggi'],
  ['강원', 'gangwon'],
  ['충북', 'chungbuk'],
  ['충남', 'chungnam'],
  ['전북', 'jeonbuk'],
  ['전남', 'jeonnam'],
  ['경북', 'gyeongbuk'],
  ['경남', 'gyeongnam'],
  ['제주', 'jeju'],
  // '광주'는 맨 뒤에 둔다. 경기도 광주시가 있어 '경기 광주시'를 광주광역시로
  // 읽으면 안 된다. 위의 '경기'가 먼저 맞아 이 줄까지 오지 않는다.
  ['광주', 'gwangju'],
] as const;

export function provinceCodeForAddress(address: string): string | null {
  const text = address.trim();
  if (!text) return null;

  // 시·도는 주소 맨 앞에 온다. 뒤쪽에 걸린 이름은 그 주소의 시·도가 아니다.
  for (const [name, code] of PROVINCE_PREFIX) {
    if (text.startsWith(name)) return code;
  }
  return null;
}
