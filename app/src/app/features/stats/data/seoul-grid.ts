import type { GridCell } from '../util/hex-geometry';

/**
 * 서울 25개 자치구의 육각 격자 배치.
 *
 * 서울만 하위 격자를 만드는 이유는 칸 배치를 손으로 해야 하기 때문이다. 한
 * 곳으로 방식이 검증되면 나머지 시·도는 이런 파일을 추가하는 것으로 늘린다.
 *
 * 한강을 기준으로 위쪽 강북, 아래쪽 강남을 배치한다. r이 커질수록 남쪽이다.
 */

export const SEOUL_GRID: readonly GridCell[] = [
  // 북부
  cell(2, 0, 'seoul-dobong'), cell(3, 0, 'seoul-nowon'),
  cell(1, 1, 'seoul-eunpyeong'), cell(2, 1, 'seoul-gangbuk'), cell(3, 1, 'seoul-jungnang'),

  // 중북부
  cell(1, 2, 'seoul-seodaemun'), cell(2, 2, 'seoul-seongbuk'), cell(3, 2, 'seoul-dongdaemun'),
  cell(0, 3, 'seoul-mapo'), cell(1, 3, 'seoul-jongno'), cell(2, 3, 'seoul-jung'),
  cell(3, 3, 'seoul-seongdong'), cell(4, 3, 'seoul-gwangjin'),

  // 한강 언저리
  cell(0, 4, 'seoul-gangseo'), cell(1, 4, 'seoul-yeongdeungpo'), cell(2, 4, 'seoul-yongsan'),
  cell(4, 4, 'seoul-gangdong'),

  // 남부
  cell(0, 5, 'seoul-yangcheon'), cell(1, 5, 'seoul-dongjak'), cell(2, 5, 'seoul-seocho'),
  cell(3, 5, 'seoul-gangnam'), cell(4, 5, 'seoul-songpa'),
  cell(0, 6, 'seoul-guro'), cell(1, 6, 'seoul-gwanak'), cell(2, 6, 'seoul-geumcheon'),
];

function cell(q: number, r: number, regionCode: string): GridCell {
  return { q, r, regionCode };
}
