/**
 * 아이소메트릭 육각 블록의 좌표 계산.
 *
 * 3D 라이브러리를 쓰지 않는다. 시점이 고정되어 있어 회전이 없으므로 실제
 * 3D가 주는 이점이 거의 없고, 기획안 11절이 전체 지도를 3D로 만들지 말라고
 * 정하고 있다. 육각형 하나를 윗면·왼쪽면·오른쪽면 세 다각형으로 그린다.
 */

export interface GridCell {
  readonly q: number;
  readonly r: number;
  readonly regionCode: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface BlockShape {
  /** 윗면 육각형. SVG polygon의 points 값 */
  top: string;
  /** 왼쪽 옆면. 높이가 0이면 빈 문자열 */
  left: string;
  /** 오른쪽 옆면. 높이가 0이면 빈 문자열 */
  right: string;
}

/** 블록 하나의 치수. 화면 비율을 바꾸려면 여기만 고친다. */
export const HEX = {
  /** 육각형 가로 반지름 */
  radiusX: 16,
  /** 육각형 세로 반지름. 납작하게 눌러 위에서 비스듬히 본 느낌을 만든다. */
  radiusY: 9,
  /** q가 1 늘 때 가로 이동량 */
  stepX: 14,
  /** q나 r이 1 늘 때 세로 이동량 */
  stepY: 8,
  /** 높이 1단계가 올리는 픽셀 */
  levelHeight: 7,
} as const;

/** 높이 단계의 최댓값. 색 단계도 같은 수를 쓴다. */
export const MAX_LEVEL = 5;

/** 격자 좌표를 화면 좌표로 옮긴다. */
export function hexCenter(cell: Pick<GridCell, 'q' | 'r'>): Point {
  return {
    x: (cell.q - cell.r) * HEX.stepX,
    y: (cell.q + cell.r) * HEX.stepY,
  };
}

/**
 * 방문 횟수를 0에서 5까지의 높이 단계로 바꾼다.
 *
 * 한 번이라도 방문했으면 최소 1단계를 준다. 1회 방문이 미방문과 같은 높이로
 * 보이면 갔다는 사실 자체가 지도에서 사라진다.
 */
export function heightLevel(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  const ratio = Math.min(count / max, 1);
  return Math.max(1, Math.ceil(ratio * MAX_LEVEL));
}

/** 블록 하나의 세 면을 만든다. */
export function blockShape(cell: Pick<GridCell, 'q' | 'r'>, level: number): BlockShape {
  const center = hexCenter(cell);
  const lift = Math.max(0, level) * HEX.levelHeight;
  const top = hexPoints(center.x, center.y - lift);

  if (lift === 0) return { top, left: '', right: '' };

  // 옆면은 윗면의 아래쪽 모서리를 바닥까지 내린 사각형이다. 위쪽 모서리는
  // 시점상 보이지 않으므로 그리지 않는다.
  const [, , lowerRight, bottom, lowerLeft] = hexCorners(center.x, center.y - lift);
  return {
    top,
    left: quad(lowerLeft, bottom, drop(bottom, lift), drop(lowerLeft, lift)),
    right: quad(bottom, lowerRight, drop(lowerRight, lift), drop(bottom, lift)),
  };
}

/**
 * 뒤쪽 칸부터 그리도록 정렬한다.
 *
 * q + r이 작을수록 화면 위쪽에 있고, 앞쪽 블록에 가려져야 한다. SVG는 나중에
 * 그린 것이 위에 오므로 뒤쪽을 먼저 그린다.
 */
export function drawOrder<T extends Pick<GridCell, 'q' | 'r'>>(cells: readonly T[]): T[] {
  return [...cells].sort((a, b) => a.q + a.r - (b.q + b.r) || a.q - b.q);
}

export interface Bounds {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

/**
 * 모든 칸을 담는 영역을 구한다. SVG viewBox에 쓴다.
 *
 * 블록이 위로 솟을 수 있으므로 최대 높이만큼 위쪽에 여백을 둔다.
 */
export function boundsOf(cells: readonly GridCell[]): Bounds {
  if (cells.length === 0) return { minX: 0, minY: 0, width: 0, height: 0 };

  const centers = cells.map(hexCenter);
  const lift = MAX_LEVEL * HEX.levelHeight;
  const minX = Math.min(...centers.map((c) => c.x)) - HEX.radiusX;
  const maxX = Math.max(...centers.map((c) => c.x)) + HEX.radiusX;
  const minY = Math.min(...centers.map((c) => c.y)) - HEX.radiusY - lift;
  const maxY = Math.max(...centers.map((c) => c.y)) + HEX.radiusY;

  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

/** 육각형 여섯 꼭짓점. 맨 위에서 시작해 시계 방향으로 돈다. */
function hexCorners(cx: number, cy: number): Point[] {
  const { radiusX: rx, radiusY: ry } = HEX;
  return [
    { x: cx, y: cy - ry }, // 위
    { x: cx + rx, y: cy - ry / 2 }, // 오른쪽 위
    { x: cx + rx, y: cy + ry / 2 }, // 오른쪽 아래
    { x: cx, y: cy + ry }, // 아래
    { x: cx - rx, y: cy + ry / 2 }, // 왼쪽 아래
    { x: cx - rx, y: cy - ry / 2 }, // 왼쪽 위
  ];
}

function hexPoints(cx: number, cy: number): string {
  return hexCorners(cx, cy).map(fmt).join(' ');
}

function quad(a: Point, b: Point, c: Point, d: Point): string {
  return [a, b, c, d].map(fmt).join(' ');
}

function drop(p: Point, by: number): Point {
  return { x: p.x, y: p.y + by };
}

/** 좌표를 SVG points 형식으로 적는다. 소수점은 두 자리까지만 남긴다. */
function fmt(p: Point): string {
  return `${round(p.x)},${round(p.y)}`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
