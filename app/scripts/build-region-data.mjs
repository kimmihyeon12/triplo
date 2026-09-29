/**
 * 경계 파일에서 지역 목록 데이터를 만든다.
 *
 * 230개를 손으로 적으면 경계 파일과 어긋나고, 어긋나면 지도에 있는 지역이
 * 목록에 없거나 그 반대가 된다. 한쪽을 원본으로 두고 생성한다.
 *
 * 쓰는 법:
 *   node scripts/build-region-data.mjs
 *
 * 경계 파일을 새로 만든 뒤에 이어서 돌린다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const GEO = resolve(here, '../public/geo/korea-municipalities-2026.geo.json');
const OUT = resolve(here, '../src/app/shared/util/korea-regions.data.ts');

const geo = JSON.parse(readFileSync(GEO, 'utf-8'));

/** 시·도 번호 → 짧은 이름. 화면에서 지역을 구분할 때 쓴다. */
const SHORT = {
  '11': '서울', '12': '전남광주', '26': '부산', '27': '대구', '28': '인천',
  '30': '대전', '31': '울산', '36': '세종', '41': '경기', '43': '충북',
  '44': '충남', '47': '경북', '48': '경남', '50': '제주', '51': '강원', '52': '전북',
};

const rows = geo.features.map((f) => f.properties);
const missing = rows.filter((p) => !SHORT[p.sido]);
if (missing.length) {
  console.error('짧은 이름이 없는 시·도가 있습니다:', [...new Set(missing.map((p) => `${p.sido} ${p.sidonm}`))]);
  process.exit(1);
}

// 같은 이름이 여러 시·도에 있으면 화면에 시·도를 괄호로 덧붙여 구분한다.
const nameCount = new Map();
for (const p of rows) nameCount.set(p.nm, (nameCount.get(p.nm) ?? 0) + 1);

const regions = rows
  .map((p) => ({
    code: p.cd,
    name: p.nm,
    label: nameCount.get(p.nm) > 1 ? `${p.nm}(${SHORT[p.sido]})` : p.nm,
    province: p.sidonm,
    provinceCode: p.sido,
    short: SHORT[p.sido],
  }))
  .sort((a, b) => a.code.localeCompare(b.code, 'ko'));

const dup = regions.filter((r, i) => i > 0 && regions[i - 1].code === r.code);
if (dup.length) {
  console.error('코드가 겹칩니다:', dup.map((r) => r.code));
  process.exit(1);
}

const body = regions
  .map((r) => `  { code: '${r.code}', name: '${r.name}', label: '${r.label}', province: '${r.province}', provinceCode: '${r.provinceCode}', short: '${r.short}' },`)
  .join('\n');

const provinces = Object.entries(SHORT)
  .map(([code, short]) => {
    const one = regions.find((r) => r.provinceCode === code);
    return `  { code: '${code}', name: '${one.province}', short: '${short}' },`;
  })
  .join('\n');

writeFileSync(
  OUT,
  `/*
  이 파일은 scripts/build-region-data.mjs가 만든다. 직접 고치지 않는다.

  원본은 public/geo/korea-municipalities-2026.geo.json이며 2026-07-01 기준
  행정구역이다. 지역을 더하거나 빼려면 경계 파일을 바꾼 뒤 스크립트를 다시
  돌린다. 그래야 지도에 있는 지역과 목록이 어긋나지 않는다.
*/
import type { KoreaProvince, KoreaRegion } from './korea-regions.types';

/** 시·도 ${Object.keys(SHORT).length}개. */
export const PROVINCE_DATA: readonly KoreaProvince[] = [
${provinces}
];

/** 시·군·구 ${regions.length}개. 코드 순으로 둔다. */
export const REGION_DATA: readonly KoreaRegion[] = [
${body}
];
`,
  'utf-8',
);

/*
  개수만 따로 둔다. 여행 목록 첫 화면의 배너는 '230개 지역 중 몇 곳'을
  적으려고 숫자 하나만 쓰는데, 목록 파일에서 가져오면 41KB짜리 지역 배열이
  통째로 첫 화면 번들에 실린다. 스크립트가 함께 만들어 두 값이 어긋나지
  않게 한다.
*/
const COUNT_OUT = resolve(here, '../src/app/shared/util/korea-regions.count.ts');
writeFileSync(
  COUNT_OUT,
  `/*
  이 파일은 scripts/build-region-data.mjs가 만든다. 직접 고치지 않는다.

  지역 목록 전체를 들이지 않고 개수만 필요한 자리를 위한 파일이다.
  숫자 하나를 얻으려고 korea-regions.data.ts를 가져오면 그 배열이 통째로
  같은 묶음에 들어간다.
*/

/** 시·군·구 개수. korea-regions.data.ts의 REGION_DATA 길이와 같다. */
export const REGION_COUNT = ${regions.length};
`,
  'utf-8',
);

console.log(`만들었습니다: ${OUT}`);
console.log(`만들었습니다: ${COUNT_OUT}`);
console.log(`시·도 ${Object.keys(SHORT).length}개 / 지역 ${regions.length}개`);
console.log(`구분용 괄호가 붙은 지역: ${regions.filter((r) => r.label !== r.name).length}개`);
