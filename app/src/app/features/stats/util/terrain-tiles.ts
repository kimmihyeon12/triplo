import type { Cell, Point } from '../../../shared/util/geo/geo-types';

// Decorative offsets in cell units only; never persisted as geographic coordinates.
function seed(col: number, row: number): Point {
  const noise = (salt: number) => {
    const value = Math.sin(col * 127.1 + row * 311.7 + salt) * 43758.5453;
    return (value - Math.floor(value) - 0.5) * 0.72;
  };
  return { x: noise(19), y: noise(73) };
}

/** Local Voronoi pieces, including virtual sea neighbours to bound coastal cells. */
export function terrainTile(cell: Pick<Cell, 'col' | 'row'>): { center: Point; outline: Point[] } {
  const center = seed(cell.col, cell.row);
  let outline: Point[] = [{ x: -2, y: -2 }, { x: 2, y: -2 }, { x: 2, y: 2 }, { x: -2, y: 2 }];
  for (let row = -2; row <= 2; row++) {
    for (let col = -2; col <= 2; col++) {
      if (!col && !row) continue;
      const other = seed(cell.col + col, cell.row + row);
      const dx = col + other.x - center.x;
      const dy = row + other.y - center.y;
      const mx = (center.x + col + other.x) / 2;
      const my = (center.y + row + other.y) / 2;
      const distance = (p: Point) => (p.x - mx) * dx + (p.y - my) * dy;
      const clipped: Point[] = [];
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i], b = outline[(i + 1) % outline.length];
        const da = distance(a), db = distance(b);
        if (da <= 0) clipped.push(a);
        if ((da <= 0) !== (db <= 0)) {
          const t = da / (da - db);
          clipped.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        }
      }
      outline = clipped;
    }
  }
  return { center, outline };
}
