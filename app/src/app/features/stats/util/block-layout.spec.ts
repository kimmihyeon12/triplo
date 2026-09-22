import { describe, expect, it } from 'vitest';
import type { VoxelGrid } from '../../../shared/util/geo/geo-types';
import { buildBlockLayout } from './block-layout';

const cells = Array.from({ length: 81 }, (_, index) => {
  const col = index % 9;
  const row = Math.floor(index / 9);
  return { col, row, x: col * 10, y: row * 10, regionCode: col < 5 ? 'a' : 'b' };
});
const grid: VoxelGrid = { cells, cellSize: 10, centers: new Map([['a', { x: 20, y: 40 }], ['b', { x: 60, y: 40 }]]), bounds: { minX: 0, maxX: 80, minY: 0, maxY: 80 } };

describe('block map aggregate clusters', () => {
  it('widens existing visit clusters when coverage reaches half of the regions', () => {
    const threeRegions: VoxelGrid = { ...grid,
      cells: [...grid.cells, { col: 100, row: 100, x: 1000, y: 1000, regionCode: 'c' }],
      centers: new Map([...grid.centers, ['c', { x: 1000, y: 1000 }]]),
    };
    const sparse = buildBlockLayout(threeRegions, new Map([['a', 6]]));
    const covered = buildBlockLayout(threeRegions, new Map([['a', 6], ['c', 1]]));
    expect(covered.columns.filter(c => c.visitRegion === 'a').length).toBeGreaterThan(sparse.columns.filter(c => c.visitRegion === 'a').length);
    expect(covered.anchors.get('a')!.height).toBe(sparse.anchors.get('a')!.height);
    expect(covered.columns).toHaveLength(threeRegions.cells.length);
  });
  it('spreads frequent visits over more tiles than rare visits', () => {
    const low = buildBlockLayout(grid, new Map([['a', 1]]));
    const high = buildBlockLayout(grid, new Map([['a', 21]]));
    expect(high.columns.filter(c => c.levels > 0).length).toBeGreaterThan(low.columns.filter(c => c.levels > 0).length);
    expect(high.anchors.get('a')!.levels).toBeGreaterThan(low.anchors.get('a')!.levels);
  });
  it('does not rescale a peak when visits elsewhere change', () => {
    const first = buildBlockLayout(grid, new Map([['a', 5], ['b', 5]]));
    const second = buildBlockLayout(grid, new Map([['a', 5], ['b', 1000]]));
    expect(second.anchors.get('a')!.levels).toBe(first.anchors.get('a')!.levels);
  });
  it('keeps all land white with no fabricated visits when the repository is empty', () => {
    const result = buildBlockLayout(grid, new Map());
    expect(result.columns).toHaveLength(cells.length);
    expect(result.columns.every(c => c.levels === 0 && c.visitRegion === null)).toBe(true);
  });
  it('builds discrete stepped clusters instead of painting an entire province', () => {
    const result = buildBlockLayout(grid, new Map([['a', 48]]));
    const levels = result.columns.map(c => c.levels);
    expect(Math.max(...levels)).toBeGreaterThanOrEqual(5);
    expect(new Set(levels).size).toBeGreaterThan(3);
    expect(levels.every(Number.isInteger)).toBe(true);
    expect(result.columns.find(c => c.cell.col === 0 && c.cell.row === 0)?.levels).toBe(0);
    expect(result.columns.filter(c => c.levels > 0).every(c => c.visitRegion === 'a')).toBe(true);
  });
  it('keeps cluster ownership distinct from underlying geography for picking', () => {
    const result = buildBlockLayout(grid, new Map([['a', 48], ['b', 4]]));
    const a = Math.max(...result.columns.filter(c => c.visitRegion === 'a').map(c => c.levels));
    const b = Math.max(...result.columns.filter(c => c.visitRegion === 'b').map(c => c.levels));
    expect(a).toBeGreaterThan(b);
    expect(result.columns.every(c => grid.cells.includes(c.cell))).toBe(true);
    expect(result.anchors.get('a')?.cell.regionCode).toBe('a');
    expect(result.anchors.get('b')?.cell.regionCode).toBe('b');
  });
  it('ignores unknown and invalid counts without adding land or changing input data', () => {
    const counts = new Map([['unknown', 99], ['a', NaN], ['b', -1]]);
    const result = buildBlockLayout(grid, counts);
    expect(result.columns.every(c => c.levels === 0)).toBe(true);
    expect(counts.get('unknown')).toBe(99);
    expect(buildBlockLayout({ ...grid, cells: [], centers: new Map() }, counts).columns).toEqual([]);
  });
  it('raises an unvisited region label above any neighboring aggregate on its land anchor', () => {
    const adjacent = { ...grid, centers: new Map([['a', { x: 40, y: 40 }], ['b', { x: 50, y: 40 }]]) };
    const result = buildBlockLayout(adjacent, new Map([['a', 48]]));
    const anchor = result.anchors.get('b')!;
    const column = result.columns.find(c => c.cell === anchor.cell)!;
    expect(column.visitRegion).toBe('a');
    expect(column.levels).toBeGreaterThan(0);
    expect(anchor.levels).toBe(column.levels);
    expect(anchor.cell.regionCode).toBe('b');
  });
});

/*
  나주와 순천은 둘 다 전남이지만 약 70km 떨어져 있다. 시·도마다 한 덩어리로
  찍으면 아무도 가지 않은 중간에 색이 들어간다. 실제 방문 자리를 받아 각각
  찍는다(2026-09-21 결정).
*/
describe('방문 자리별 군집', () => {
  it('자리를 주면 그 근처에 군집을 만든다', () => {
    const left = buildBlockLayout(grid, new Map([['a', 6]]), 1, [
      { regionCode: 'a', x: 0, y: 0, count: 6 },
    ]);
    const anchor = left.anchors.get('a')!;
    // 지역 a는 x 0~40에 걸쳐 있다. 목표가 왼쪽 끝이면 앵커도 왼쪽이다.
    expect(anchor.cell.x).toBeLessThan(20);
  });

  it('자리가 여럿이면 각각 군집을 만든다', () => {
    const two = buildBlockLayout(grid, new Map([['a', 6]]), 1, [
      { regionCode: 'a', x: 0, y: 0, count: 3 },
      { regionCode: 'a', x: 40, y: 80, count: 3 },
    ]);
    const lit = two.columns.filter((c) => c.levels > 0);
    // 서로 먼 두 자리가 켜져 한 덩어리로 뭉치지 않는다.
    const xs = lit.map((c) => c.cell.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(20);
  });

  it('자리를 주지 않으면 지금처럼 시·도 중심을 쓴다', () => {
    const before = buildBlockLayout(grid, new Map([['a', 6]]));
    const after = buildBlockLayout(grid, new Map([['a', 6]]), 1, []);
    expect(after.anchors.get('a')!.cell).toEqual(before.anchors.get('a')!.cell);
  });

  it('다른 지역 자리는 그 지역 칸만 쓴다', () => {
    const cross = buildBlockLayout(grid, new Map([['a', 6]]), 1, [
      // b 지역 한가운데를 가리켜도 a의 앵커는 a 칸에서 고른다.
      { regionCode: 'a', x: 80, y: 40, count: 6 },
    ]);
    expect(cross.anchors.get('a')!.cell.regionCode).toBe('a');
  });
});
