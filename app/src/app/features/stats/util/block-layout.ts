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

/** Build presentation-only clusters on verified land without modifying stored visits. */
export function buildBlockLayout(grid: VoxelGrid, counts: ReadonlyMap<string, number>, radiusScale = 1) {
  const anchors = new Map<string, { cell: Cell; levels: number; height: number }>();
  for (const [code, center] of grid.centers) {
    const own = grid.cells.filter(cell => cell.regionCode === code);
    if (!own.length) continue;
    const cell = own.reduce((a, b) => Math.hypot(a.x - center.x, a.y - center.y) <= Math.hypot(b.x - center.x, b.y - center.y) ? a : b);
    anchors.set(code, { cell, levels: 0, height: 0 });
  }
  const visited = [...anchors].filter(([code]) => Number.isFinite(counts.get(code)) && counts.get(code)! > 0);
  const spread = anchors.size && visited.length / anchors.size >= 0.5 ? 1.18 : 1;
  const columns: BlockColumn[] = grid.cells.map(cell => {
    const candidates = visited.map(([code, anchor]) => ({ code, anchor, distance: Math.hypot(cell.x - anchor.cell.x, cell.y - anchor.cell.y) / grid.cellSize,
      level: visitLevel(counts.get(code)!), radius: VISIT_STEPS[visitLevel(counts.get(code)!) - 1].radius * spread * radiusScale }))
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
  const elevation = new Map(columns.map(column => [column.cell, column.levels]));
  const heights = new Map(columns.map(column => [column.cell, column.height]));
  for (const anchor of anchors.values()) {
    anchor.levels = elevation.get(anchor.cell) ?? 0;
    anchor.height = heights.get(anchor.cell) ?? 0;
  }
  return { columns, anchors };
}
