/**
 * 주소에서 행정구역을 읽는다.
 *
 * 여행에 담은 지역과 장소의 실제 위치가 다를 수 있다. '광주 여행'에 구례와
 * 함평 장소를 넣으면 세 장소가 모두 여행 지역 '광주'를 가리켜, 전남 방문이
 * 광주로 집계되고 전남에는 색이 칠해지지 않았다(2026-09-22 확인). 저장된
 * 주소는 장소 검색에서 고른 검증된 값이므로 그것을 읽어 채운다. 없는 값을
 * 지어내지 않는다.
 *
 * 두 단계로 읽는다. 시·도를 먼저 확정하고 그 안에서 시·군·구를 찾는다.
 * 순서를 지키는 이유는 '중구'가 다섯 시·도에, '서구'가 네 시·도에 있어서
 * 시·도 없이는 어느 곳인지 정할 수 없기 때문이다.
 */
import { KOREA_PROVINCES, KOREA_REGIONS } from '../../../shared/util/korea-regions';

/**
 * 주소 앞머리에 오는 시·도 표기와 번호.
 *
 * 저장된 주소는 2026-07-01 통합 이전 것이 많다. '광주광역시'와 '전라남도'를
 * 지금의 전남광주통합특별시(12)로 함께 읽어야 예전 기록이 살아난다. 마찬가지로
 * '전라북도'·'강원도'처럼 바뀌기 전 이름도 받는다.
 *
 * 긴 표기를 먼저 둔다. '광주광역시'를 '광주'로 먼저 맞추면 뒤 글자를 놓친다.
 */
const PROVINCE_PREFIX: readonly (readonly [string, string])[] = (() => {
  const rows: [string, string][] = [];

  // 현행 정식 명칭과 짧은 이름. 목록에서 그대로 가져온다.
  for (const province of KOREA_PROVINCES) {
    rows.push([province.name, province.code]);
    rows.push([province.short, province.code]);
  }

  /*
    예전 표기. 통합·개칭 전 주소가 저장되어 있으므로 함께 받는다.
    '광주'는 경기도 광주시와 겹치므로 여기 두지 않고 아래에서 따로 다룬다.
  */
  const legacy: [string, string][] = [
    ['광주광역시', '12'],
    ['전라남도', '12'],
    ['전남', '12'],
    ['전라북도', '52'],
    ['강원도', '51'],
    ['제주도', '50'],
  ];
  rows.push(...legacy);

  // 긴 것부터 맞춘다. 같은 길이면 순서를 고정해 결과가 흔들리지 않게 한다.
  return rows.sort((a, b) => b[0].length - a[0].length || a[0].localeCompare(b[0], 'ko'));
})();

/** 시·도 번호 → 그 안의 시·군·구 [이름, 코드] 목록. 긴 이름을 먼저 둔다. */
const REGIONS_BY_PROVINCE = new Map<string, (readonly [string, string])[]>();
for (const region of KOREA_REGIONS) {
  const list = REGIONS_BY_PROVINCE.get(region.provinceCode) ?? [];
  list.push([region.name, region.code] as const);
  REGIONS_BY_PROVINCE.set(region.provinceCode, list);
}
for (const list of REGIONS_BY_PROVINCE.values()) {
  // '중랑구'를 '중구'로 잘못 읽지 않게 긴 이름을 먼저 맞춘다.
  list.sort((a, b) => b[0].length - a[0].length || a[0].localeCompare(b[0], 'ko'));
}

/**
 * 주소를 시·도와 나머지로 가른다. 시·도를 읽지 못하면 null.
 *
 * 시·군·구를 찾으려면 시·도를 뗀 나머지가 필요하다. 두 번 읽지 않도록
 * 한 번에 돌려준다.
 */
function splitAddress(address: string): { provinceCode: string; rest: string } | null {
  const text = address.trim();
  if (!text) return null;

  // 시·도는 주소 맨 앞에 온다. 뒤쪽에 걸린 이름은 그 주소의 시·도가 아니다.
  for (const [name, code] of PROVINCE_PREFIX) {
    if (text.startsWith(name)) {
      return { provinceCode: code, rest: text.slice(name.length).trim() };
    }
  }
  // '광주'는 맨 뒤에 본다. 경기도 광주시가 있어 위에서 '경기'가 먼저 맞는다.
  if (text.startsWith('광주')) return { provinceCode: '12', rest: text.slice(2).trim() };
  return null;
}

/**
 * 주소에서 시·도 번호를 읽는다. 읽지 못하면 null.
 *
 * '광주'로 시작하는 주소는 통합특별시로 본다. 경기도 광주시 주소는 '경기'나
 * '경기도'가 앞에 오므로 여기까지 오지 않는다.
 */
export function provinceCodeForAddress(address: string): string | null {
  return splitAddress(address)?.provinceCode ?? null;
}

/**
 * 주소에서 시·군·구 코드를 읽는다. 읽지 못하면 null.
 *
 * 수원시 팔달구처럼 일반구가 붙은 주소는 '수원시'에서 멈춘다. 지도와 목록이
 * 수원을 한 단위로 세기 때문이며, 긴 이름을 먼저 맞추는 규칙이 '수원시'를
 * 고르게 한다.
 */
export function regionCodeForAddress(address: string): string | null {
  const split = splitAddress(address);
  if (!split) return null;

  const candidates = REGIONS_BY_PROVINCE.get(split.provinceCode);
  if (!candidates) return null;

  for (const [name, code] of candidates) {
    if (split.rest.startsWith(name)) return code;
  }
  /*
    접미사를 뗀 이름으로 한 번 더 본다. 옛 주소에는 '여수 종화동'처럼 '시'가
    빠진 표기가 있다. 이름이 두 글자 미만이면 우연히 맞을 수 있어 건너뛴다.
  */
  for (const [name, code] of candidates) {
    const bare = name.replace(/(특별자치)?[시군구]$/, '');
    if (bare.length >= 2 && split.rest.startsWith(bare)) return code;
  }
  return null;
}
