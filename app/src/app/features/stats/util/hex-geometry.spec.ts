import { describe, expect, it } from 'vitest';
import { HEX, blockShape, boundsOf, drawOrder, heightLevel, hexCenter } from './hex-geometry';

describe('hexCenter', () => {
  it('원점 칸은 원점에 둔다', () => {
    expect(hexCenter({ q: 0, r: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('q가 커지면 오른쪽 아래로 간다', () => {
    // 아이소메트릭이므로 한 축이 늘면 가로와 세로가 함께 움직인다.
    const a = hexCenter({ q: 1, r: 0 });
    expect(a.x).toBeGreaterThan(0);
    expect(a.y).toBeGreaterThan(0);
  });

  it('r이 커지면 왼쪽 아래로 간다', () => {
    const a = hexCenter({ q: 0, r: 1 });
    expect(a.x).toBeLessThan(0);
    expect(a.y).toBeGreaterThan(0);
  });

  it('q와 r이 같이 커지면 가로는 제자리, 세로만 내려간다', () => {
    const a = hexCenter({ q: 1, r: 1 });
    expect(a.x).toBeCloseTo(0);
    expect(a.y).toBeCloseTo(HEX.stepY * 2);
  });
});

describe('heightLevel', () => {
  it('방문이 없으면 0단계다', () => {
    expect(heightLevel(0, 10)).toBe(0);
  });

  it('가장 많이 방문한 지역이 최고 단계다', () => {
    expect(heightLevel(10, 10)).toBe(5);
  });

  it('최댓값이 0이면 모두 0단계다', () => {
    expect(heightLevel(0, 0)).toBe(0);
  });

  it('한 번이라도 방문했으면 최소 1단계다', () => {
    // 1회 방문이 미방문과 같은 높이로 보이면 갔다는 사실이 사라진다.
    expect(heightLevel(1, 100)).toBe(1);
  });

  it('많이 갈수록 단계가 오른다', () => {
    const levels = [1, 3, 5, 8, 10].map((n) => heightLevel(n, 10));
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
    }
  });

  it('단계는 0에서 5 사이에 머문다', () => {
    for (let n = 0; n <= 20; n++) {
      const level = heightLevel(n, 20);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(5);
    }
  });
});

describe('blockShape', () => {
  it('윗면과 두 옆면을 만든다', () => {
    const shape = blockShape({ q: 0, r: 0 }, 2);
    expect(shape.top.split(' ')).toHaveLength(6);
    expect(shape.left).toBeTruthy();
    expect(shape.right).toBeTruthy();
  });

  it('높이가 0이면 옆면을 만들지 않는다', () => {
    // 미방문 지역은 바닥에 눕는다. 없는 높이를 그리면 방문한 것처럼 보인다.
    const shape = blockShape({ q: 0, r: 0 }, 0);
    expect(shape.left).toBe('');
    expect(shape.right).toBe('');
  });

  it('높이가 클수록 윗면이 위로 올라간다', () => {
    const low = topY(blockShape({ q: 0, r: 0 }, 1).top);
    const high = topY(blockShape({ q: 0, r: 0 }, 5).top);
    expect(high).toBeLessThan(low);
  });
});

describe('drawOrder', () => {
  it('뒤쪽 칸을 먼저 그린다', () => {
    const cells = [
      { q: 1, r: 1, regionCode: 'front' },
      { q: 0, r: 0, regionCode: 'back' },
    ];
    expect(drawOrder(cells).map((c) => c.regionCode)).toEqual(['back', 'front']);
  });

  it('원본 배열을 바꾸지 않는다', () => {
    const cells = [
      { q: 1, r: 1, regionCode: 'front' },
      { q: 0, r: 0, regionCode: 'back' },
    ];
    drawOrder(cells);
    expect(cells[0].regionCode).toBe('front');
  });
});

describe('boundsOf', () => {
  it('모든 칸을 담는 영역을 낸다', () => {
    const box = boundsOf([
      { q: 0, r: 0, regionCode: 'a' },
      { q: 2, r: 2, regionCode: 'b' },
    ]);
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  it('칸이 없으면 빈 영역을 낸다', () => {
    const box = boundsOf([]);
    expect(box.width).toBe(0);
    expect(box.height).toBe(0);
  });
});

/** 다각형 점 목록에서 가장 위쪽 y를 꺼낸다. */
function topY(points: string): number {
  return Math.min(...points.split(' ').map((p) => Number(p.split(',')[1])));
}
