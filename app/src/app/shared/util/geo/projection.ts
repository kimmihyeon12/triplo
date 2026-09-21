import type { LngLat, Point } from './geo-types';

/**
 * 경위도를 평면으로 펴는 계산.
 *
 * 경위도를 그대로 x·y로 쓰면 한국처럼 위도가 높은 곳은 가로로 늘어나 보인다.
 * 위도 37도에서 경도 1도는 약 89km인데 위도 1도는 약 111km이기 때문이다.
 *
 * 나라 하나를 그리는 데 완전한 측지 계산은 필요하지 않다. 기준 위도에서
 * 경도 간격을 줄여주는 것만으로 눈에 띄는 왜곡이 사라진다. 이 방식을
 * 등거리 원통 도법이라 부르며, 좁은 범위에서 오차가 작다.
 */

/** 적도에서 위도 1도가 차지하는 거리(km). */
const KM_PER_DEGREE = 111.32;

/**
 * 투영에 쓸 기준점.
 *
 * 기준 위도에서 경도가 얼마나 좁아지는지 계산하고, 기준점을 원점으로 삼아
 * 결과 좌표가 0 근처에 오게 한다. 큰 수를 쓰면 정밀도가 떨어진다.
 */
export interface ProjectionOrigin {
  readonly lng: number;
  readonly lat: number;
}

/** 대한민국 전체를 담는 기준점. 남한의 대략 가운데다. */
export const KOREA_ORIGIN: ProjectionOrigin = { lng: 127.5, lat: 36.0 };

/** 서울을 담는 기준점. 서울시청 부근이다. */
export const SEOUL_ORIGIN: ProjectionOrigin = { lng: 126.978, lat: 37.566 };

export function createProjection(origin: ProjectionOrigin): (p: LngLat) => Point {
  // 기준 위도에서 경도 1도가 차지하는 거리. 위도가 높을수록 짧아진다.
  const lngScale = Math.cos((origin.lat * Math.PI) / 180) * KM_PER_DEGREE;
  return ({ lng, lat }) => ({
    x: (lng - origin.lng) * lngScale,
    // 화면은 y가 아래로 커지지만 위도는 위로 커진다. 부호를 뒤집어 맞춘다.
    y: -(lat - origin.lat) * KM_PER_DEGREE,
  });
}

/**
 * 점이 다각형 안에 있는지 판정한다.
 *
 * 점에서 오른쪽으로 반직선을 그어 변과 몇 번 만나는지 센다. 홀수면 안쪽,
 * 짝수면 바깥이다. 구멍(호수·내륙 경계)은 같은 방식으로 한 번 더 세어
 * 상쇄한다.
 */
export function pointInRing(point: Point, ring: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    // 변이 점의 높이를 가로지르는지 본다. 한쪽 끝만 위에 있어야 한다.
    const crosses = a.y > point.y !== b.y > point.y;
    if (!crosses) continue;
    // 그 높이에서 변의 x가 점보다 오른쪽이면 한 번 만난 것이다.
    const at = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (point.x < at) inside = !inside;
  }
  return inside;
}

/** 바깥 고리 안에 있고 구멍에는 들어가지 않았는지 본다. */
export function pointInPolygon(point: Point, rings: readonly (readonly Point[])[]): boolean {
  if (rings.length === 0) return false;
  if (!pointInRing(point, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(point, rings[i])) return false;
  }
  return true;
}
