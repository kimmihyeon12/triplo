import { describe, expect, it } from 'vitest';
import { fitShot, layoutSpots, SPOT_PAD } from './spotlight';

const spot = (x: number, y: number, w: number, h: number, label = '설명') => ({ x, y, w, h, label });
const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('사용법 설명 배치', () => {
  it('위쪽 요소는 아래에, 아래쪽 요소는 위에 설명을 둔다', () => {
    const { callouts } = layoutSpots([spot(20, 40, 100, 40, '위'), spot(20, 600, 100, 40, '아래')], 360, 700);
    expect(callouts.find((c) => c.label === '위')!.side).toBe('below');
    expect(callouts.find((c) => c.label === '아래')!.side).toBe('above');
  });

  it('밝게 뚫는 자리는 요소보다 조금 넓다', () => {
    const { holes } = layoutSpots([spot(50, 100, 80, 30)], 360, 700);
    expect(holes[0]).toEqual({ x: 50 - SPOT_PAD, y: 100 - SPOT_PAD, w: 80 + SPOT_PAD * 2, h: 30 + SPOT_PAD * 2, r: 8 + SPOT_PAD });
  });

  it('나란한 두 요소의 설명은 서로 겹치지 않는다', () => {
    const { callouts } = layoutSpots(
      [spot(16, 60, 160, 44, '조건만 고르면 AI가 코스를 짜 줘요'), spot(184, 60, 160, 44, '직접 여행을 만들 수도 있어요')],
      360,
      700,
    );
    expect(overlap(callouts[0]!.box, callouts[1]!.box)).toBe(false);
  });

  it('설명 글은 다른 밝은 자리를 가리지 않는다', () => {
    const { callouts, holes } = layoutSpots([spot(16, 60, 328, 44, '첫째'), spot(16, 140, 328, 80, '둘째')], 360, 700);
    const first = callouts.find((c) => c.label === '첫째')!;
    expect(overlap(first.box, holes[1]!)).toBe(false);
  });

  it('설명 글은 화면 안에 있고 선은 자리 가장자리에서 글까지 잇는다', () => {
    const { callouts, holes } = layoutSpots([spot(300, 650, 56, 40, '아주 긴 설명 글이 화면 밖으로 나가지 않아요')], 360, 700);
    const [c] = callouts;
    expect(c!.box.x).toBeGreaterThanOrEqual(12);
    expect(c!.box.x + c!.box.w).toBeLessThanOrEqual(348);
    expect(c!.fromY).toBe(holes[0]!.y);
    expect(c!.toY).toBe(c!.box.y + c!.box.h);
  });
});

describe('밝은 자리 사이 여백', () => {
  it('붙어 있는 두 버튼의 밝은 자리는 사이를 띄운다', () => {
    const { holes } = layoutSpots([spot(16, 60, 160, 44, '왼쪽'), spot(184, 60, 160, 44, '오른쪽')], 360, 700);
    const [a, b] = holes;
    expect(b!.x - (a!.x + a!.w)).toBeGreaterThanOrEqual(4);
  });

  it('위아래로 붙은 두 요소도 사이를 띄운다', () => {
    const { holes } = layoutSpots([spot(16, 60, 328, 40, '위'), spot(16, 104, 328, 40, '아래')], 360, 700);
    const [a, b] = holes;
    expect(b!.y - (a!.y + a!.h)).toBeGreaterThanOrEqual(4);
  });

  it('가까운 이웃이 있어도 네 방향 여백이 같아 요소가 정확히 가운데 온다', () => {
    const left = spot(16, 60, 160, 44, '왼쪽');
    const { holes } = layoutSpots([left, spot(184, 60, 160, 44, '오른쪽')], 360, 700);
    const h = holes[0]!;
    const pads = [left.x - h.x, left.y - h.y, h.x + h.w - (left.x + left.w), h.y + h.h - (left.y + left.h)];
    expect(new Set(pads).size).toBe(1);
  });

  it('테두리 모서리는 요소의 둥글기에 여백을 더한다', () => {
    const { holes } = layoutSpots([{ ...spot(50, 100, 80, 30), r: 12 }], 360, 700);
    expect(holes[0]!.r).toBe(12 + SPOT_PAD);
  });
});

describe('캡처 맞추기', () => {
  it('스크롤 없이 다 보이게 폭·높이 중 좁은 쪽에 맞추고 가운데 둔다', () => {
    expect(fitShot({ width: 390, height: 844 }, 360, 1000)).toEqual({ x: 0, y: 0, w: 360, h: 779 });
    expect(fitShot({ width: 390, height: 844 }, 360, 552)).toEqual({ x: 53, y: 0, w: 255, h: 552 });
    expect(fitShot({ width: 390, height: 844 }, 1280, 2000)).toEqual({ x: 425, y: 0, w: 430, h: 931 });
  });
});
