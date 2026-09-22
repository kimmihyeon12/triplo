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

export interface KoreaRegion {
  /**
   * 집계와 지도가 공유하는 키. 시·도 번호와 이름을 붙인다. 예: '12_여수시'
   *
   * 표시 이름 대신 코드를 쓰는 이유는 두 가지다. 지명이 바뀌어도 과거 기록이
   * 끊기지 않고, '중구(서울)'처럼 화면에서 구분하려고 붙인 괄호가 키에
   * 섞이지 않는다.
   */
  readonly code: string;
  /** 행정구역 이름. 예: '여수시', '종로구' */
  readonly name: string;
  /**
   * 화면에 적을 이름. 같은 이름이 여러 시·도에 있으면 시·도를 덧붙인다.
   * '중구'는 다섯 곳이라 '중구(서울)'로 적어야 어디인지 알 수 있다.
   */
  readonly label: string;
  /** 정식 시·도 이름. 예: '전남광주통합특별시' */
  readonly province: string;
  /** 시·도 번호. code의 앞부분과 같다. 예: '12' */
  readonly provinceCode: string;
  /** 후보 목록에 붙이는 짧은 표기. 예: '전남광주' */
  readonly short: string;
}

export interface KoreaProvince {
  /** 시·도 번호. 예: '12' */
  readonly code: string;
  /** 정식 이름. 예: '전남광주통합특별시' */
  readonly name: string;
  /** 짧은 표기. 예: '전남광주' */
  readonly short: string;
}

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
 * 화면 이름('중구(서울)')과 행정구역 이름('중구') 양쪽을 담는다. 이름이
 * 겹치는 '중구'는 먼저 담긴 하나만 남으므로, 겹치는 이름으로 찾으면 어느
 * 곳인지 확정할 수 없다. 그런 이름은 시·도를 함께 받는 쪽을 쓴다.
 */
const BY_NAME = new Map<string, KoreaRegion>();
for (const region of KOREA_REGIONS) {
  BY_NAME.set(region.label, region);
  if (!BY_NAME.has(region.name)) BY_NAME.set(region.name, region);
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
