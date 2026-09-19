import type { GridCell } from '../util/hex-geometry';

/**
 * 시·도 17개의 육각 격자 배치.
 *
 * 실제 행정구역 경계(GeoJSON)를 쓰지 않는다. 원본이 수 MB 단위라 단순화
 * 전처리와 라이선스 확인이 필요한데, 이 화면의 목적은 정확한 지리 정보가
 * 아니라 '어디를 많이 갔는지 한눈에 보기'다.
 *
 * 나중에 실제 경계로 바꾸더라도 이 파일의 내용만 바뀐다. 다른 코드는
 * GridCell 배열만 본다.
 *
 * 격자 축은 화면 기준으로 q가 오른쪽 아래, r이 왼쪽 아래를 향한다. 따라서
 * q - r이 동서, q + r이 남북에 대응한다. 북서쪽이 (0,0)에 가깝다.
 */

/**
 * 시·도별 격자 칸. 넓은 도는 여러 칸을 차지해 실제 면적 감각을 흉내 낸다.
 * 칸 수가 곧 지도에서 차지하는 크기이므로 광역시는 한두 칸만 쓴다.
 */
export const KOREA_GRID: readonly GridCell[] = [
  // 경기·서울·인천 (수도권)
  cell(2, 0, 'gyeonggi'), cell(3, 0, 'gyeonggi'),
  cell(2, 1, 'incheon'), cell(3, 1, 'seoul'), cell(4, 1, 'gyeonggi'),
  cell(3, 2, 'gyeonggi'), cell(4, 2, 'gyeonggi'),

  // 강원 (동북부)
  cell(4, 0, 'gangwon'), cell(5, 0, 'gangwon'), cell(6, 0, 'gangwon'),
  cell(5, 1, 'gangwon'), cell(6, 1, 'gangwon'),

  // 충청 (중부)
  cell(3, 3, 'chungnam'), cell(4, 3, 'sejong'), cell(5, 2, 'chungbuk'),
  cell(2, 3, 'chungnam'), cell(5, 3, 'chungbuk'), cell(4, 4, 'daejeon'),

  // 경북·대구 (동부)
  cell(6, 2, 'gyeongbuk'), cell(7, 1, 'gyeongbuk'), cell(7, 2, 'gyeongbuk'),
  cell(6, 3, 'gyeongbuk'), cell(7, 3, 'daegu'),

  // 전라 (서남부)
  cell(2, 4, 'jeonbuk'), cell(3, 4, 'jeonbuk'),
  cell(2, 5, 'jeonnam'), cell(3, 5, 'gwangju'), cell(4, 5, 'jeonnam'),
  cell(3, 6, 'jeonnam'),

  // 경남·부산·울산 (동남부)
  cell(5, 4, 'gyeongnam'), cell(6, 4, 'gyeongnam'), cell(7, 4, 'ulsan'),
  cell(5, 5, 'gyeongnam'), cell(6, 5, 'busan'),

  // 제주 (남쪽 바다 건너. 한 칸 띄워 섬이라는 것을 보인다)
  cell(3, 8, 'jeju'),
];

function cell(q: number, r: number, regionCode: string): GridCell {
  return { q, r, regionCode };
}

/** 시·도별로 라벨을 붙일 대표 칸. 여러 칸을 가진 도는 가운데 칸을 쓴다. */
export const PROVINCE_LABEL_CELL: Record<string, GridCell> = labelCells();

function labelCells(): Record<string, GridCell> {
  const byProvince = new Map<string, GridCell[]>();
  for (const c of KOREA_GRID) {
    const list = byProvince.get(c.regionCode) ?? [];
    list.push(c);
    byProvince.set(c.regionCode, list);
  }
  const result: Record<string, GridCell> = {};
  for (const [code, cells] of byProvince) {
    // 가운데에 가까운 칸을 고른다. 라벨이 지도 가장자리로 밀리지 않게 한다.
    const sorted = [...cells].sort((a, b) => a.q + a.r - (b.q + b.r));
    result[code] = sorted[Math.floor(sorted.length / 2)];
  }
  return result;
}
