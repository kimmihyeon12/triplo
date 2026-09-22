import { visitColor, visitLevel, type VisitPalette } from '../../util/visit-style';

/**
 * 배너 섬네일의 방문 점 하나.
 *
 * 섬네일은 76×58 남짓이다. 지도 화면의 육각 격자 35칸을 그대로 줄이면 칸이
 * 너무 작아져 한반도로 읽히지 않는다. 그래서 배너에서는 윤곽 하나와 방문
 * 점으로 형태를 먼저 보이고, 정확한 격자는 지도 화면에 맡긴다.
 */
export interface VisitDot {
  regionCode: string;
  cx: number;
  cy: number;
  /** 점 반지름 */
  r: number;
  /** 바깥 번짐. 점보다 크고 옅다 */
  haloR: number;
  fill: string;
}

/**
 * 남한 윤곽. 실제 행정 경계가 아니라 형태만 따온 장식이다.
 *
 * 저장하는 값이 아니므로 정확한 좌표를 쓰지 않는다. 경계가 필요한 계산은
 * 모두 지도 화면의 격자가 맡는다.
 */
export const MAINLAND_PATH =
  'M30 4 C34 4 37 6 39 9 C41 12 44 13 47 15 C50 17 51 20 50 23 ' +
  'C49 26 50 29 52 32 C54 35 55 39 54 43 C53 47 50 50 48 54 ' +
  'C46 58 45 62 43 66 C41 70 38 73 34 74 C30 75 26 74 23 71 ' +
  'C20 68 19 64 19 60 C19 56 17 53 14 51 C11 49 9 46 9 42 ' +
  'C9 38 11 35 12 31 C13 27 12 23 13 19 C14 15 17 11 21 8 ' +
  'C24 6 27 4 30 4 Z';

/** 제주는 본토와 떨어져 있어 따로 그린다. */
export const JEJU = { cx: 23, cy: 86, rx: 7.5, ry: 4.6 } as const;

/** 본토 위끝(y≈4)부터 제주 아래끝(y≈91)까지만 담아 여백을 남기지 않는다. */
export const BANNER_VIEWBOX = '6 1 52 91';

/** 윤곽선 색. 흰 지형이 옅은 바다에 묻히지 않도록 잡아 준다. */
export const OUTLINE = '#b3d4e6';

/**
 * 시·도별 점 자리. 윤곽 위의 대략적인 위치이며 실제 좌표가 아니다.
 *
 * 배너는 손톱만 한 축약 지도라 시·군·구 230개를 찍을 수 없다. 집계는
 * 시·군·구 단위지만 여기서는 시·도로 묶어 16개 점만 둔다.
 * 2026-07-01에 광주와 전남이 합쳐져 점도 하나가 되었다.
 */
const DOT_AT: Record<string, readonly [number, number]> = {
  '11': [25, 20],  // 서울
  '28': [18, 24],  // 인천
  '41': [31, 27],  // 경기
  '51': [41, 18],  // 강원
  '43': [36, 33],  // 충북
  '44': [22, 34],  // 충남
  '36': [28, 36],  // 세종
  '30': [30, 40],  // 대전
  '47': [44, 37],  // 경북
  '27': [40, 44],  // 대구
  '52': [26, 47],  // 전북
  '12': [24, 57],  // 전남광주. 옛 전남과 광주 점의 가운데에 둔다.
  '48': [36, 55],  // 경남
  '26': [42, 56],  // 부산
  '31': [45, 48],  // 울산
  '50': [23, 86],  // 제주
};

/** 지역 코드에서 시·도 번호를 뗀다. '12_여수시' → '12' */
function provinceOf(code: string): string {
  const cut = code.indexOf('_');
  return cut === -1 ? code : code.slice(0, cut);
}

/**
 * 방문 횟수를 섬네일 점으로 바꾼다.
 *
 * counts가 비어 있으면 빈 배열을 돌려준다. 기록이 없는데 점을 찍으면 없는
 * 기록을 있는 것처럼 보이게 만들기 때문이다.
 */
export function visitDots(
  counts: ReadonlyMap<string, number>,
  palette: VisitPalette,
): VisitDot[] {
  const dots: VisitDot[] = [];

  // 집계는 시·군·구 단위다. 점은 시·도마다 하나이므로 합쳐서 센다.
  const byProvince = new Map<string, number>();
  for (const [regionCode, count] of counts) {
    const province = provinceOf(regionCode);
    byProvince.set(province, (byProvince.get(province) ?? 0) + count);
  }

  for (const [regionCode, count] of byProvince) {
    const at = DOT_AT[regionCode];
    if (!at) continue;

    const level = visitLevel(count);
    if (!level) continue;

    /*
      서울과 경기처럼 실제로 붙어 있는 지역은 점도 가깝다. 크기 폭이 너무
      넓으면 큰 점이 이웃을 덮으므로 최대 반지름을 억제한다.
    */
    const strength = (level - 1) / 4;
    const r = 2.3 + strength * 2.6;

    dots.push({
      regionCode,
      cx: at[0],
      cy: at[1],
      r: Number(r.toFixed(1)),
      haloR: Number((r + 1.4).toFixed(1)),
      fill: visitColor(strength, palette),
    });
  }

  // 큰 점이 작은 점을 덮지 않도록 작은 것부터 그린다.
  return dots.sort((a, b) => b.r - a.r);
}
