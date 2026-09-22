import type { Cell, VoxelGrid } from '../../../shared/util/geo/geo-types';
import { VISIT_STEPS, visitLevel } from './visit-style';

export interface BlockColumn {
  cell: Cell;
  /** Decorative aggregate layers; never individual place coordinates. */
  levels: number;
  height: number;
  visitRegion: string | null;
  strength: number;
}

/** 지도에 찍을 방문 자리. 평면 좌표이며 실제 다녀온 곳에서 낸다. */
export interface SpotAt {
  regionCode: string;
  /** 마커에 적을 이름. 주소에서 읽은 시·군이다. */
  name: string;
  x: number;
  y: number;
  /** 이 자리에 모인 장소 수. 높이와 색을 정한다. */
  count: number;
}

/**
 * Build presentation-only clusters on verified land without modifying stored visits.
 *
 * 자리(spots)를 주면 그 자리마다 군집을 만든다. 주지 않으면 시·도마다 한
 * 덩어리를 중심에 놓는다. 나주와 순천은 둘 다 전남이지만 약 70km 떨어져
 * 있어, 한 덩어리로 묶으면 아무도 가지 않은 중간에 색이 들어간다
 * (2026-09-21 결정).
 */
export function buildBlockLayout(grid: VoxelGrid, counts: ReadonlyMap<string, number>, radiusScale = 1,
  spots: readonly SpotAt[] = []) {
  const anchors = new Map<string, { cell: Cell; levels: number; height: number }>();
  const byRegion = new Map<string, Cell[]>();
  for (const cell of grid.cells) {
    if (cell.regionCode === null) continue;
    const list = byRegion.get(cell.regionCode);
    if (list) list.push(cell); else byRegion.set(cell.regionCode, [cell]);
  }
  /** 그 지역 칸 중 목표에 가장 가까운 것. 목표가 경계 밖이어도 지역을 넘지 않는다. */
  const nearestCell = (code: string, x: number, y: number): Cell | null => {
    const own = byRegion.get(code);
    if (!own?.length) return null;
    return own.reduce((a, b) => Math.hypot(a.x - x, a.y - y) <= Math.hypot(b.x - x, b.y - y) ? a : b);
  };

  for (const [code, center] of grid.centers) {
    const cell = nearestCell(code, center.x, center.y);
    if (cell) anchors.set(code, { cell, levels: 0, height: 0 });
  }

  /**
   * 군집의 씨앗. 자리가 있으면 그 자리마다, 없으면 지역마다 하나씩 둔다.
   * level은 그 자리에 모인 수로 정해 여러 번 간 곳이 더 크게 퍼진다.
   */
  const seeds: { code: string; cell: Cell; level: number }[] = [];
  /** 자리별로 고른 칸. 마커가 같은 자리에 서도록 부르는 쪽에 돌려준다. */
  const spotCells: { spot: SpotAt; cell: Cell }[] = [];
  const placed = new Set<string>();
  for (const spot of spots) {
    const cell = nearestCell(spot.regionCode, spot.x, spot.y);
    if (!cell) continue;
    spotCells.push({ spot, cell });
    const level = visitLevel(spot.count);
    if (!level) continue;
    seeds.push({ code: spot.regionCode, cell, level });
    placed.add(spot.regionCode);
  }
  // 자리를 못 받은 지역은 지금처럼 중심에 한 덩어리를 둔다. 좌표가 없는
  // 장소만 담긴 지역이 여기 해당한다.
  for (const [code, anchor] of anchors) {
    if (placed.has(code)) continue;
    const total = counts.get(code);
    if (!Number.isFinite(total) || !total || total <= 0) continue;
    seeds.push({ code, cell: anchor.cell, level: visitLevel(total) });
  }

  // 절반 넘는 지역에 기록이 있으면 군집을 조금 넓혀 지도가 성기게 보이지
  // 않게 한다. 기준은 '기록이 있는 지역 수'이며 자리를 받았는지와 무관하다.
  const litRegions = new Set(seeds.map(seed => seed.code)).size;
  const spread = anchors.size && litRegions / anchors.size >= 0.5 ? 1.18 : 1;
  const columns: BlockColumn[] = grid.cells.map(cell => {
    const candidates = seeds.map(seed => ({ code: seed.code, distance: Math.hypot(cell.x - seed.cell.x, cell.y - seed.cell.y) / grid.cellSize,
      level: seed.level, radius: VISIT_STEPS[seed.level - 1].radius * spread * radiusScale }))
      .filter(candidate => candidate.distance < candidate.radius)
      .sort((a, b) => a.distance - b.distance || a.code.localeCompare(b.code));
    const nearest = candidates[0];
    if (!nearest) return { cell, levels: 0, height: 0, visitRegion: null, strength: 0 };
    const falloff = Math.pow(1 - nearest.distance / nearest.radius, 1.35);
    const height = Math.max(1, VISIT_STEPS[nearest.level - 1].height * falloff);
    // 층 두께는 최고 높이에 맞춘다. 높이를 낮추면서 두께를 그대로 두면
    // 층이 몇 개로 줄어 군집이 계단이 아니라 한 덩어리로 보인다.
    const levels = Math.ceil(height / 1.75);
    return { cell, levels, height, visitRegion: nearest.code, strength: (nearest.level - 1) / 4 * falloff };
  });
  // 라벨은 가장 큰 군집 위에 선다. 자리가 여럿이면 중심이 아니라 실제로
  // 많이 간 곳을 가리켜야 마커와 지형이 어긋나지 않는다.
  const best = new Map<string, { cell: Cell; level: number }>();
  for (const seed of seeds) {
    const prev = best.get(seed.code);
    if (!prev || seed.level > prev.level) best.set(seed.code, { cell: seed.cell, level: seed.level });
  }
  for (const [code, anchor] of anchors) {
    const top = best.get(code);
    if (top) anchor.cell = top.cell;
  }

  const elevation = new Map(columns.map(column => [column.cell, column.levels]));
  const heights = new Map(columns.map(column => [column.cell, column.height]));
  for (const anchor of anchors.values()) {
    anchor.levels = elevation.get(anchor.cell) ?? 0;
    anchor.height = heights.get(anchor.cell) ?? 0;
  }
  return { columns, anchors, spotCells };
}
