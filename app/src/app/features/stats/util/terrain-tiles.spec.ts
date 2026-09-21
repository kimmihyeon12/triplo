import { describe, expect, it } from 'vitest';
import { terrainTile } from './terrain-tiles';

describe('irregular presentation terrain', () => {
  it('is stable and varies silhouettes without changing the geographic cell', () => {
    const cell = { col: 3, row: 4, x: 30, y: 40, regionCode: 'seoul' };
    const original = { ...cell };
    expect(terrainTile(cell)).toEqual(terrainTile(cell));
    expect(cell).toEqual(original);
    const tiles = Array.from({ length: 20 }, (_, col) => terrainTile({ col, row: 4 }));
    expect(new Set(tiles.map(tile => tile.outline.length)).size).toBeGreaterThan(1);
    expect(tiles.every(tile => tile.outline.length >= 3)).toBe(true);
  });
  it('keeps adjacent tiles on their own side of the shared bisector', () => {
    const a = terrainTile({ col: 4, row: 4 });
    const b = terrainTile({ col: 5, row: 4 });
    const dx = 1 + b.center.x - a.center.x;
    const dy = b.center.y - a.center.y;
    const mx = (a.center.x + 1 + b.center.x) / 2;
    const my = (a.center.y + b.center.y) / 2;
    expect(a.outline.every(p => (p.x - mx) * dx + (p.y - my) * dy <= 1e-8)).toBe(true);
    expect(b.outline.every(p => (1 + p.x - mx) * dx + (p.y - my) * dy >= -1e-8)).toBe(true);
    const common = a.outline.filter(p => b.outline.some(q => Math.hypot(p.x - (q.x + 1), p.y - q.y) < 1e-8));
    expect(common).toHaveLength(2);
    expect(Math.hypot(common[0].x - common[1].x, common[0].y - common[1].y)).toBeGreaterThan(0.1);
  });
});
