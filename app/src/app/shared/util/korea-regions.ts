/**
 * 국내 여행 지역 목록. 2026-07-01 기준 시·군·구 230개다.
 *
 * 고정 목록을 쓰는 이유는 지명만 정확히 받기 위해서다. 자유 입력은 오타와
 * 표기 흔들림('강릉'/'강릉시'/'강릉 시')을 막을 수 없고, 장소 검색은 상호까지
 * 섞여 나와 지역 단위와 맞지 않는다.
 *
 * 목록의 원본은 지도가 읽는 경계 파일이며 `scripts/build-region-data.mjs`가
 * `korea-regions.data.ts`를 만든다. 한쪽에서 생성하는 이유는 둘이 어긋나면
 * 지도에 있는 지역이 목록에 없거나 그 반대가 되기 때문이다. 행정구역이
 * 바뀌면 경계 파일을 갈고 스크립트를 다시 돌린다.
 */
import { PROVINCE_DATA, REGION_DATA } from './korea-regions.data';
import type { KoreaProvince, KoreaRegion } from './korea-regions.types';

export type { KoreaProvince, KoreaRegion };

/** 시·도 16개. 2026-07-01에 광주와 전남이 전남광주통합특별시로 합쳐졌다. */
export const KOREA_PROVINCES = PROVINCE_DATA;

/** 검색·선택에 쓰는 평평한 목록. 시·군·구 230개다. */
export const KOREA_REGIONS = REGION_DATA;

const BY_CODE = new Map(KOREA_REGIONS.map((r) => [r.code, r]));

/** 코드로 지역을 찾는다. 없으면 null. */
export function findRegionByCode(code: string): KoreaRegion | null {
  return BY_CODE.get(code) ?? null;
}

/**
 * 이름으로 지역을 찾는 색인.
 *
 * 화면 이름('중구(서울)'), 행정구역 이름('중구'), 접미사를 뗀 이름('여수')을
 * 모두 담는다. 접미사 없는 이름을 받는 까닭은 저장된 여행 때문이다. 예전
 * 목록은 '여수'였고 지금은 '여수시'라, 접미사를 붙인 이름만 보면 예전 여행이
 * 통계에서 사라진다(2026-09-22 확인).
 *
 * 이름이 겹치는 '중구'는 먼저 담긴 하나만 남는다. 겹치는 이름으로 찾으면
 * 어느 곳인지 확정할 수 없으므로 그런 이름은 시·도를 함께 받는 쪽을 쓴다.
 */
const BY_NAME = new Map<string, KoreaRegion>();
for (const region of KOREA_REGIONS) {
  BY_NAME.set(region.label, region);
  if (!BY_NAME.has(region.name)) BY_NAME.set(region.name, region);
}
for (const region of KOREA_REGIONS) {
  // 접미사를 뗀 이름은 나중에 담는다. 정식 이름이 먼저 자리를 잡아야
  // '중구'로 찾았을 때 '중구'인 곳이 나오지 접미사를 뗀 딴 곳이 나오지 않는다.
  const bare = region.name.replace(/(특별자치)?[시군구]$/, '');
  if (bare.length >= 2 && !BY_NAME.has(bare)) BY_NAME.set(bare, region);
}

/**
 * 시·도 이름으로 찾는 보조 색인.
 *
 * 정식 명칭('전남광주통합특별시')과 짧은 이름('전남광주') 양쪽을 담는다.
 * 여행이 시·군·구가 아니라 시·도를 통째로 담는 경우가 있고, 그 이름이
 * 목록에 없어 통계에서 미분류로 떨어졌다(2026-09-21 확인). 그 시·도의 첫
 * 지역을 돌려준다.
 */
const BY_PROVINCE_NAME = new Map<string, KoreaRegion>();
for (const region of KOREA_REGIONS) {
  if (!BY_PROVINCE_NAME.has(region.province)) BY_PROVINCE_NAME.set(region.province, region);
  if (!BY_PROVINCE_NAME.has(region.short)) BY_PROVINCE_NAME.set(region.short, region);
}

/**
 * 없어진 시·도 이름. 저장된 여행이 옛 이름을 그대로 담고 있다.
 *
 * 2026-07-01에 광주광역시와 전라남도가 전남광주통합특별시가 되었고, 그 전에
 * 전라북도·강원도·제주도도 이름이 바뀌었다. 옛 이름을 받지 않으면 그 여행이
 * 통계에서 미분류로 빠진다(2026-09-22 확인).
 */
const LEGACY_PROVINCE_NAME: Record<string, string> = {
  광주광역시: '12', 광주: '12', 전라남도: '12', 전남: '12',
  전라북도: '52', 강원도: '51', 제주도: '50',
};
for (const [name, code] of Object.entries(LEGACY_PROVINCE_NAME)) {
  if (BY_PROVINCE_NAME.has(name)) continue;
  const one = KOREA_REGIONS.find((r) => r.provinceCode === code);
  if (one) BY_PROVINCE_NAME.set(name, one);
}

/**
 * 표시 이름으로 지역을 찾는다. 없으면 null.
 *
 * 코드를 갖지 않은 예전 여행을 집계할 때 쓴다. 행정구역 이름을 먼저 보고
 * 없으면 시·도 이름으로 찾는다. 순서를 지키는 이유는 '광주'처럼 시·도와
 * 시·군에 같은 이름이 있기 때문이다.
 */
export function findRegionByName(name: string): KoreaRegion | null {
  const key = name.trim();
  return BY_NAME.get(key) ?? BY_PROVINCE_NAME.get(key) ?? null;
}

/**
 * 이 이름이 시·군·구를 정확히 가리키는지 본다.
 *
 * '서울'처럼 시·도 이름만 있으면 어느 자치구인지 알 수 없다. 그런데도 그
 * 시·도의 첫 지역을 집계 키로 쓰면, 주소 없는 장소가 모두 강남구에 다녀온
 * 것으로 표시된다(2026-09-22 확인). 시·도 단위로 셀 때는 어느 지역이 뽑히든
 * 상관없었지만 시·군·구 단위에서는 틀린 값이 된다.
 */
export function isExactRegionName(name: string): boolean {
  return BY_NAME.has(name.trim());
}

/** 이 이름이 가리키는 시·도 번호. 시·도 이름일 때만 값이 나온다. */
export function provinceCodeByName(name: string): string | null {
  const key = name.trim();
  if (BY_NAME.has(key)) return null;
  return BY_PROVINCE_NAME.get(key)?.provinceCode ?? null;
}

/** 지역 코드에서 시·도 번호를 뗀다. '12_여수시' → '12' */
export function provinceCodeOf(code: string): string {
  const cut = code.indexOf('_');
  return cut === -1 ? code : code.slice(0, cut);
}

/** 시·도 번호에 붙일 짧은 이름. */
export const PROVINCE_SHORT_NAME: Record<string, string> = Object.fromEntries(
  KOREA_PROVINCES.map((p) => [p.code, p.short]),
);

/** 지역 코드에 붙일 화면 이름. 지도 라벨과 통계 집계가 같은 표를 쓴다. */
export const REGION_LABEL: Record<string, string> = Object.fromEntries(
  KOREA_REGIONS.map((r) => [r.code, r.label]),
);

/**
 * 입력한 글자로 지역을 찾는다. 세 단계로 나누어 담는다.
 *
 * 1. 지명이 그 글자로 시작하는 곳: '강' → 강릉시, 강진군, 강화군
 * 2. 지명 안에 그 글자가 들어 있는 곳: '천' → 춘천시, 이천시
 * 3. 시·도 이름이 걸린 곳: '강원' → 강원 시·군 전체
 *
 * 시·도 이름은 맨 뒤에 둔다. 앞에 섞으면 '강'을 쳤을 때 이름에 '강'이 없는
 * 춘천·원주가 위로 올라와 무엇을 찾았는지 알기 어렵다.
 */
export function searchRegions(query: string, limit = 8): readonly KoreaRegion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: KoreaRegion[] = [];
  const contains: KoreaRegion[] = [];
  const byProvince: KoreaRegion[] = [];
  for (const region of KOREA_REGIONS) {
    /*
      '시'·'군'·'구' 접미사를 뗀 이름으로도 맞춘다. 사용자는 '여수'까지만
      치지 '여수시'라고 치지 않는다. 구분용 괄호는 검색 대상이 아니다.
    */
    const full = region.name.toLowerCase();
    const bare = full.replace(/(특별자치)?[시군구]$/, '');
    if (bare.startsWith(q) || full.startsWith(q)) starts.push(region);
    else if (bare.includes(q)) contains.push(region);
    else if (region.province.toLowerCase().includes(q) || region.short.toLowerCase().includes(q))
      byProvince.push(region);
  }
  return [...starts, ...contains, ...byProvince].slice(0, limit);
}
