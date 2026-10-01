/**
 * 사용법 화면의 설명 배치(2026-10-01). 화면 전체를 회색으로 덮고, 설명할 요소만 밝게 뚫은 뒤
 * 그 위나 아래에 작은 설명 말풍선을 두고 짧은 선으로 잇는다. 번호는 쓰지 않는다(지도 방문 순번과 겹친다).
 * 말풍선과 선이 다른 말풍선·밝은 자리와 겹치지 않는 자리를 위·아래, 가운데·왼쪽·오른쪽 순으로 찾는다.
 * 순수 계산만 한다. 요소의 자리(px)는 화면이 재서 넘긴다.
 */
export interface SpotBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly label: string;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface SpotCallout {
  readonly label: string;
  /** 자리 위·아래, 또는 큰 자리 안쪽 위(선 없음). */
  readonly side: 'above' | 'below' | 'inside';
  /** 말풍선 상자(px). */
  readonly box: Rect;
  /** 밝게 뚫은 자리의 가장자리 점과 말풍선 가장자리를 잇는 세로 선. 안쪽이면 그리지 않는다. */
  readonly x: number;
  readonly fromY: number;
  readonly toY: number;
}

export interface SpotLayout {
  readonly holes: readonly Rect[];
  readonly callouts: readonly SpotCallout[];
}

/** 뚫은 자리를 요소보다 조금 넓힌다. */
export const SPOT_PAD = 5;
/** 화면 가장자리 여백. */
const EDGE = 12;
/** 말풍선은 모두 한 줄, 같은 높이다. 11px 글자, 안쪽 여백 7·4px. */
export const BUBBLE_H = 23;
const PAD_X = 7;
/** 글 폭을 재는 함수가 없을 때 11px 글자 한 자의 대략 폭. */
const CHAR = 11;
/** 선 길이 후보. 짧은 자리부터 시험한다. */
const DISTANCES = [14, 30, 50, 76];

const overlaps = (a: Rect, b: Rect, gap = 4) =>
  a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** 캡처를 스크롤 없이 한 화면에 다 보이게 맞춘다(폭·높이 중 좁은 쪽, 최대 휴대폰 폭 430px). 가로 가운데·위쪽에 둔다. */
export const SHOT_MAX_W = 430;

export function fitShot(shot: { width: number; height: number }, width: number, height: number): Rect {
  const scale = Math.min(width / shot.width, height / shot.height, SHOT_MAX_W / shot.width);
  const w = Math.round(shot.width * scale);
  return { x: Math.round((width - w) / 2), y: 0, w, h: Math.round(shot.height * scale) };
}

/** 이웃한 두 요소의 밝은 자리가 붙거나 겹치지 않게 사이를 띄운다. */
const SPLIT = 6;

function holesFor(spots: readonly SpotBox[], width: number, height: number): Rect[] {
  const sides = spots.map((s) => ({
    l: Math.max(2, s.x - SPOT_PAD),
    t: Math.max(2, s.y - SPOT_PAD),
    r: Math.min(width - 2, s.x + s.w + SPOT_PAD),
    b: Math.min(height - 2, s.y + s.h + SPOT_PAD),
  }));
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      const a = spots[i]!;
      const b = spots[j]!;
      const ha = sides[i]!;
      const hb = sides[j]!;
      const meet = ha.l < hb.r + SPLIT && hb.l < ha.r + SPLIT && ha.t < hb.b + SPLIT && hb.t < ha.b + SPLIT;
      if (!meet) continue;
      // 요소끼리 떨어진 방향으로 그 사이의 가운데에서 나눈다. 요소 자체가 겹치면 그대로 둔다.
      if (a.x + a.w <= b.x || b.x + b.w <= a.x) {
        const [left, right, hl, hr] = a.x < b.x ? [a, b, ha, hb] : [b, a, hb, ha];
        const mid = (left.x + left.w + right.x) / 2;
        hl.r = Math.min(hl.r, mid - SPLIT / 2);
        hr.l = Math.max(hr.l, mid + SPLIT / 2);
      } else if (a.y + a.h <= b.y || b.y + b.h <= a.y) {
        const [top, bottom, ht, hb2] = a.y < b.y ? [a, b, ha, hb] : [b, a, hb, ha];
        const mid = (top.y + top.h + bottom.y) / 2;
        ht.b = Math.min(ht.b, mid - SPLIT / 2);
        hb2.t = Math.max(hb2.t, mid + SPLIT / 2);
      }
    }
  }
  return sides.map((h) => ({ x: h.l, y: h.t, w: h.r - h.l, h: h.b - h.t }));
}

/**
 * 자리마다 위·아래(큰 자리는 안쪽 위까지), 선 길이, 가운데·왼쪽·오른쪽 맞춤을 모두 시험해 겹침이 가장 적은 곳을 고른다.
 * 말풍선끼리 겹침이 가장 나쁘고, 다른 밝은 자리를 가리는 것, 선이 지나가는 것 순으로 피한다.
 * measure는 설명 글의 실제 폭(px)을 잰다. 화면은 실제 글꼴로 재서 넘긴다.
 */
export function layoutSpots(
  spots: readonly SpotBox[],
  width: number,
  height: number,
  measure: (text: string) => number = (text) => text.length * CHAR,
): SpotLayout {
  const holes = holesFor(spots, width, height);

  const order = spots.map((_, i) => i).sort((a, b) => holes[a]!.y - holes[b]!.y);
  const placed: Rect[] = [];
  /** 이미 그은 선. 다른 말풍선이 선을 가리지 않게 한다. */
  const lines: Rect[] = [];
  const callouts: SpotCallout[] = [];
  const h = BUBBLE_H;

  for (const i of order) {
    const hole = holes[i]!;
    const label = spots[i]!.label;
    const w = Math.min(width - EDGE * 2, Math.ceil(measure(label)) + PAD_X * 2);
    const center = hole.x + hole.w / 2;
    const preferred: 'above' | 'below' = height - (hole.y + hole.h) >= hole.y ? 'below' : 'above';
    const xs = [center - w / 2, hole.x, hole.x + hole.w - w].map((x) => clamp(x, EDGE, width - EDGE - w));
    const others = holes.filter((_, j) => j !== i);

    let best: { cost: number; callout: SpotCallout } | null = null;
    const consider = (side: SpotCallout['side'], x: number, y: number, d: number) => {
      if (y < 4 || y + h > height - 4) return;
      const box = { x, y, w, h };
      let lineX = clamp(center, x + 8, x + w - 8);
      let line: Rect | null = null;
      if (side !== 'inside') {
        const lo = Math.max(hole.x + 8, x + 8);
        const hi = Math.min(hole.x + hole.w - 8, x + w - 8);
        if (lo > hi) return;
        lineX = clamp(center, lo, hi);
        line = side === 'below' ? { x: lineX, y: hole.y + hole.h, w: 1, h: d } : { x: lineX, y: y + h, w: 1, h: d };
      }
      const hits = (list: readonly Rect[], r: Rect | null, gap = 4) => (r ? list.filter((o) => overlaps(r, o, gap)).length : 0);
      const cost =
        hits(placed, box) * 1000 +
        hits(others, box) * 100 +
        (hits(lines, box, 0) + hits(placed, line, 0) + hits(others, line, 0)) * 30 +
        (side === preferred ? 0 : side === 'inside' ? 12 : 6) +
        d / 10;
      if (best && best.cost <= cost) return;
      const fromY = side === 'below' ? hole.y + hole.h : side === 'above' ? hole.y : y;
      const toY = side === 'below' ? y : side === 'above' ? y + h : y;
      best = { cost, callout: { label, side, box, x: lineX, fromY, toY } };
    };

    for (const d of DISTANCES) {
      for (const x of xs) {
        consider('below', x, hole.y + hole.h + d, d);
        consider('above', x, hole.y - d - h, d);
      }
    }
    // 지도처럼 큰 자리는 그 안쪽 위에 둘 수 있다.
    if (hole.h > height * 0.3) for (const x of xs) consider('inside', x, hole.y + 10, 0);

    const chosen: SpotCallout =
      (best as { callout: SpotCallout } | null)?.callout ??
      { label, side: 'inside', box: { x: xs[0]!, y: clamp(hole.y + 10, 4, height - h - 4), w, h }, x: center, fromY: 0, toY: 0 };
    placed.push(chosen.box);
    if (chosen.side !== 'inside') lines.push({ x: chosen.x, y: Math.min(chosen.fromY, chosen.toY), w: 1, h: Math.abs(chosen.toY - chosen.fromY) });
    callouts.push(chosen);
  }
  return { holes, callouts };
}
