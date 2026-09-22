/**
 * 방문 통계 지도가 읽는 시·군·구 경계를 만든다.
 *
 * 원본은 행정동 3,558개짜리 33MB 파일이라 그대로 쓸 수 없다. 같은 시·군·구의
 * 행정동을 하나로 녹이고 해안선을 줄여 594KB로 만든다. 지도는 11km 격자로
 * 뭉개 그리므로 이보다 정밀해도 화면에서 달라지는 것이 없다.
 *
 * 수원·성남·창원처럼 일반구가 있는 시는 구를 상위 시로 합친다. 사용자는
 * "수원 다녀왔다"라고 하지 "수원 권선구"라고 하지 않는다. 반면 서울·부산의
 * 자치구와 통합시의 옛 광주 자치구는 생활권이 뚜렷해 그대로 둔다.
 *
 * 쓰는 법:
 *   node scripts/build-municipalities.mjs <원본.geojson>
 *
 * 원본은 아래에서 받는다. 커밋하지 않는다(33MB).
 *   https://github.com/vuski/admdongkor  ver20260701/HangJeongDong_ver20260701.geojson
 */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../public/geo/korea-municipalities-2026.geo.json');

const source = process.argv[2];
if (!source) {
  console.error('원본 GeoJSON 경로를 주세요.\n  node scripts/build-municipalities.mjs <원본.geojson>');
  process.exit(1);
}
if (!existsSync(source)) {
  console.error(`원본을 찾지 못했습니다: ${source}`);
  process.exit(1);
}

/*
  each: 일반구('수원시장안구')는 앞의 시 이름만 남긴다. 코드는 시·도 번호와
        이름을 붙여 만든다. 같은 이름이 여러 시·도에 있어도 번호가 달라
        섞이지 않는다.
  simplify 8%: 이보다 줄이면 해안가와 섬의 좌표 판정이 실패한다.
  keep-shapes: 작은 섬이 통째로 사라지지 않게 막는다.
  precision: 소수 4자리는 약 11m다. 격자 한 칸이 11km이므로 충분하다.

  명령을 배열로 주지 않고 문자열로 넘긴다. 윈도우 셸이 따옴표를 먹어
  -each 표현식이 조각나기 때문이다.
*/
const command = [
  JSON.stringify(source),
  '-each', JSON.stringify('var m = sggnm.match(/^(.+?시)(.+구)$/); nm = m ? m[1] : sggnm; cd = sido + "_" + nm'),
  '-dissolve cd copy-fields=sido,sidonm,nm',
  '-simplify 8% keep-shapes',
  '-o precision=0.0001 format=geojson', JSON.stringify(OUT),
].join(' ');

const require = createRequire(import.meta.url);
const mapshaper = require('mapshaper');

await mapshaper.runCommands(command);
console.log(`만들었습니다: ${OUT}`);
