import type { Cell, LngLat, Point, VoxelGrid } from './geo-types';
import { createProjection, pointInPolygon, type ProjectionOrigin } from './projection';

/**
 * GeoJSON 경계를 복셀 격자로 바꾼다.
 *
 * 경계 안쪽을 일정 간격으로 찍어 그 점이 어느 지역에 드는지 본다. 드는
 * 점만 육지 칸이 되고 나머지는 바다다. 간격을 좁히면 해안선이 또렷해지지만
 * 칸이 제곱으로 늘어 느려진다.
 */

/** GeoJSON에서 우리가 쓰는 부분만 추린 형태. */
export interface GeoFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry:
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] };
}

export interface GeoCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

/** 지역 하나를 평면으로 편 결과. 판정에 쓴다. */
interface ProjectedRegion {
  code: string;
  name: string;
  /** 다각형 여러 개. 섬이 있는 지역은 조각이 여럿이다. */
  polygons: Point[][][];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export interface GridOptions {
  /** 격자 한 칸의 크기(km). 작을수록 해안선이 또렷하고 느려진다. */
  readonly cellSize: number;
  readonly origin: ProjectionOrigin;
  /** 지역 코드를 꺼내는 함수. GeoJSON마다 속성 이름이 달라 밖에서 준다. */
  readonly codeOf: (properties: Record<string, unknown>) => string;
  readonly nameOf: (properties: Record<string, unknown>) => string;
}

function ringToPoints(ring: number[][], project: (p: LngLat) => Point): Point[] {
  return ring.map(([lng, lat]) => project({ lng, lat }));
}

function boundsOf(polygons: Point[][][]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const rings of polygons) {
    for (const p of rings[0]) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  return { minX, maxX, minY, maxY };
}

/** 경계 상자의 넓이. 지역 크기를 비교할 때만 쓰는 어림값이다. */
function extentOf(bounds: ProjectedRegion['bounds']): number {
  return (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
}

/**
 * 지역을 평면으로 펴고 작은 것부터 늘어놓는다.
 *
 * 순서가 중요한 이유는 칸 하나를 한 지역에만 넣기 때문이다. 광역시는 도에
 * 둘러싸여 있고 단순화된 경계에서는 두 폴리곤이 겹친다. 큰 지역을 먼저 보면
 * 작은 지역이 격자에서 통째로 사라진다. 실제로 광주가 전남에 먹혀 지도에
 * 나오지 않았다(2026-09-21 확인).
 */
function projectRegions(collection: GeoCollection, options: GridOptions): ProjectedRegion[] {
  const project = createProjection(options.origin);
  return collection.features
    .map((feature) => {
      const raw =
        feature.geometry.type === 'Polygon'
          ? [feature.geometry.coordinates]
          : feature.geometry.coordinates;
      const polygons = raw.map((rings) => rings.map((ring) => ringToPoints(ring, project)));
      return {
        code: options.codeOf(feature.properties),
        name: options.nameOf(feature.properties),
        polygons,
        bounds: boundsOf(polygons),
      };
    })
    .sort((a, b) => extentOf(a.bounds) - extentOf(b.bounds));
}

/** 점이 이 지역 안인지 본다. 범위 밖이면 다각형 판정을 건너뛴다. */
function hits(region: ProjectedRegion, point: Point): boolean {
  const b = region.bounds;
  if (point.x < b.minX || point.x > b.maxX || point.y < b.minY || point.y > b.maxY) return false;
  return region.polygons.some((rings) => pointInPolygon(point, rings));
}

/**
 * 경계를 격자로 바꾼다.
 *
 * 칸 하나가 어느 지역에 드는지는 칸 가운데 점으로 판정한다. 가장자리
 * 칸은 절반만 육지일 수 있으나, 복셀 지도는 원래 계단처럼 보이는 것이
 * 맞으므로 그대로 둔다.
 */
export function buildGrid(collection: GeoCollection, options: GridOptions): VoxelGrid {
  const regions = projectRegions(collection, options);
  if (regions.length === 0) {
    return {
      cells: [],
      cellSize: options.cellSize,
      centers: new Map(),
      bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
    };
  }

  const all = {
    minX: Math.min(...regions.map((r) => r.bounds.minX)),
    maxX: Math.max(...regions.map((r) => r.bounds.maxX)),
    minY: Math.min(...regions.map((r) => r.bounds.minY)),
    maxY: Math.max(...regions.map((r) => r.bounds.maxY)),
  };

  const size = options.cellSize;
  const cols = Math.ceil((all.maxX - all.minX) / size);
  const rows = Math.ceil((all.maxY - all.minY) / size);

  const cells: Cell[] = [];
  // 지역별로 칸 좌표를 모아 두었다가 평균으로 중심을 낸다. 다각형 무게중심을
  // 쓰면 섬이 딸린 지역에서 중심이 바다로 떨어진다.
  const sums = new Map<string, { x: number; y: number; n: number }>();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // 칸 가운데를 찍는다. 모서리를 쓰면 경계에 걸친 칸이 들쭉날쭉해진다.
      const x = all.minX + (col + 0.5) * size;
      const y = all.minY + (row + 0.5) * size;
      const point = { x, y };

      const region = regions.find((r) => hits(r, point));
      if (!region) continue;

      cells.push({ col, row, x, y, regionCode: region.code });
      const sum = sums.get(region.code) ?? { x: 0, y: 0, n: 0 };
      sums.set(region.code, { x: sum.x + x, y: sum.y + y, n: sum.n + 1 });
    }
  }

  const centers = new Map<string, Point>();
  for (const [code, sum] of sums) {
    centers.set(code, { x: sum.x / sum.n, y: sum.y / sum.n });
  }

  return { cells, cellSize: size, centers, bounds: all };
}

/** 지역 코드와 이름을 짝지어 돌려준다. 라벨에 쓴다. */
export function regionNames(
  collection: GeoCollection,
  options: Pick<GridOptions, 'codeOf' | 'nameOf'>,
): Map<string, string> {
  const names = new Map<string, string>();
  for (const feature of collection.features) {
    names.set(options.codeOf(feature.properties), options.nameOf(feature.properties));
  }
  return names;
}
