import {
  sectionSummary,
  type ItinerarySection,
  type ItineraryTicket,
} from '../util/itinerary-image';

/**
 * 일정을 티켓 한 장으로 그린다. 지도 타일과 개인 메모가 섞이지 않도록
 * DOM을 캡처하지 않고 Canvas에 직접 그린다. 색과 비율은 초대 화면 티켓을 따른다.
 */

/** 초대 화면 티켓(max-w-sm, 384px)을 2배로 키운 폭. 세로로 긴 카드 비율을 유지한다. */
const WIDTH = 768;
const MARGIN = 32;
const PAD = 40;
const LEFT = MARGIN + PAD;
const RIGHT = WIDTH - MARGIN - PAD;
const INNER = RIGHT - LEFT;
const RADIUS = 24;
const NOTCH = 16;

const GROUND = '#fbfbfa';
const PANEL = '#ffffff';
const PANEL_2 = '#fcfdfe';
const INK = '#16181d';
const INK_2 = '#4a4f58';
const INK_3 = '#6b7280';
const BORDER = '#e3e6ec';
const ACCENT = '#3b6fef';
const ACCENT_DEEP = '#2f5fdb';
const STAY_INK = '#6a4bb5';

type Align = 'left' | 'right' | 'center';
type Draw =
  | {
      kind: 'text';
      text: string;
      x: number;
      y: number;
      size: number;
      bold: boolean;
      color: string;
      align: Align;
    }
  | { kind: 'logo'; x: number; y: number; color: string };

export async function renderItineraryPng(
  ticket: ItineraryTicket,
  sections: ItinerarySection[],
  includeCosts: boolean,
  collapsed: ReadonlySet<string> = new Set(),
): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이 브라우저에서 이미지 저장을 사용할 수 없습니다.');
  const font = getComputedStyle(document.body).fontFamily;
  const draws: Draw[] = [];
  let y = MARGIN + 46;

  const setFont = (size: number, bold: boolean) => {
    ctx.font = `${bold ? 700 : 400} ${size}px ${font}`;
  };
  const put = (
    text: string,
    x: number,
    size: number,
    bold: boolean,
    color: string,
    align: Align = 'left',
    at = y,
  ) => draws.push({ kind: 'text', text, x, y: at, size, bold, color, align });

  const add = (text: string, size = 20, bold = false, color = INK, x = LEFT) => {
    setFont(size, bold);
    let line = '';
    for (const char of Array.from(text.replace(/\r/g, ''))) {
      if (char === '\n' || ctx.measureText(line + char).width > RIGHT - x) {
        put(line, x, size, bold, color);
        y += size * 1.5;
        line = char === '\n' ? '' : char;
      } else line += char;
    }
    put(line, x, size, bold, color);
    y += size * 1.5;
  };
  /** 한 줄을 넘기면 말줄임한다. 옆 칸을 침범하지 않게 한다. */
  const clip = (text: string, size: number, bold: boolean, max: number) => {
    setFont(size, bold);
    if (ctx.measureText(text).width <= max) return text;
    let out = '';
    for (const char of Array.from(text)) {
      if (ctx.measureText(out + char + '…').width > max) break;
      out += char;
    }
    return out + '…';
  };
  /** 라벨과 값을 위아래로 둔 티켓 칸. */
  const field = (label: string, value: string, x: number, top: number, max: number) => {
    put(label, x, 13, false, INK_3, 'left', top);
    put(clip(value, 18, true, max), x, 18, true, INK, 'left', top + 25);
  };

  // ── 본권: 그라데이션 위에 흰 글씨 ──────────────────────────────
  // 여백은 초대 화면 티켓과 같은 비율이 되도록 잡는다. 두 화면의 티켓이 같은 크기다.
  const stubTop = MARGIN;
  put('트립플로', LEFT + 24, 18, true, '#ffffff', 'left', y);
  draws.push({ kind: 'logo', x: LEFT, y: y - 14, color: '#ffffff' });
  put('여행 일정', RIGHT, 13, false, 'rgba(255,255,255,0.8)', 'right', y);
  y += 96;

  // 출발지 → 도착지. 국내 여행이라 이동 수단을 그리지 않고 점선만 잇는다.
  const routeY = y;
  const half = INNER / 2 - 34;
  put('FROM', LEFT, 12, false, 'rgba(255,255,255,0.7)', 'left', routeY);
  put(clip(ticket.from, 22, true, half), LEFT, 22, true, '#ffffff', 'left', routeY + 28);
  put('TO', RIGHT, 12, false, 'rgba(255,255,255,0.7)', 'right', routeY);
  put(clip(ticket.to, 22, true, half), RIGHT, 22, true, '#ffffff', 'right', routeY + 28);
  y = routeY + 112;

  put(clip(ticket.title, 22, true, INNER), LEFT, 22, true, 'rgba(255,255,255,0.92)');
  y += 60;
  const tearY = y;

  // ── 반권: 흰 바탕에 티켓 정보 ─────────────────────────────────
  // 칸 순서는 초대 화면 티켓과 같게 둔다. 같은 여행을 두 화면에서 같은 차례로 읽는다.
  const col = INNER / 2 - 12;
  y = tearY + 52;
  field('DATE', ticket.date, LEFT, y, col);
  // 종료일은 시작일과 같은 크기와 굵기로 적어 한 쌍으로 읽히게 한다.
  if (ticket.dateEnd) put(`~ ${ticket.dateEnd}`, LEFT, 18, true, INK, 'left', y + 50);
  field('PERIOD', ticket.period, LEFT + col + 24, y, col - 78);
  y += ticket.dateEnd ? 100 : 78;
  // 소인은 오른쪽 위에 겹쳐 앉는다. 칸 사이 여백으로 밀어 글자와 부딪히지 않게 한다.
  const stampX = RIGHT - 44;
  const stampY = y - 56;
  field('SCHEDULE', ticket.schedule, LEFT, y, col);
  field('REGION', ticket.region, LEFT + col + 24, y, col);
  y += 74;
  // 바코드와 NO.는 초대 화면과 같이 구분선 아래 맨 끝에 나란히 둔다.
  y += 24;
  const noRuleY = y;
  y += 30;
  const barcodeY = y;
  put(`NO. ${ticket.no}`, RIGHT, 14, false, INK_3, 'right', y + 16);
  y += 52;
  const stubBottom = y;

  // ── 일정 본문: 티켓 아래에 이어 붙인다 ─────────────────────────
  const foldedAll = sections.length > 0 && sections.every((s) => collapsed.has(s.key));
  if (!foldedAll && sections.length) {
    y = stubBottom + 56;
    for (const section of sections) {
      if (collapsed.has(section.key)) {
        const summary = sectionSummary(section, includeCosts);
        setFont(15, false);
        const summaryWidth = ctx.measureText(summary).width;
        put(clip(section.title, 19, true, INNER - summaryWidth - 24), LEFT, 19, true, ACCENT_DEEP);
        put(summary, RIGHT, 15, false, INK_2, 'right', y + 2);
        y += 19 * 1.5 + 14;
        continue;
      }
      add(section.title, 21, true, ACCENT_DEEP);
      y += 8;
      if (!section.rows.length) add('아직 등록한 일정이 없습니다.', 17, false, INK_3);
      for (const [index, row] of section.rows.entries()) {
        add(`${index + 1}. ${row.name}`, 19, true);
        if (row.detail) add(row.detail, 15, false, INK_2);
        if (includeCosts)
          add(
            row.cost == null
              ? '예상 비용 미정'
              : `예상 ${row.cost.toLocaleString('ko-KR')}원${row.name.startsWith('숙소 ·') ? ' · 숙박 전체 기준' : ''}`,
            15,
            false,
            INK_3,
          );
        y += 14;
      }
      y += 24;
    }
    y += 2;
    add('이동시간·영업정보는 별도로 확인해 주세요.', 14, false, INK_3);
    y += MARGIN;
  } else {
    y = stubBottom + MARGIN;
  }

  if (y > 16000)
    throw new Error('일정이 길어 한 장에 담기 어렵습니다. 날짜를 선택해 저장해 주세요.');
  const cardBottom = foldedAll || !sections.length ? stubBottom : y - MARGIN + 18;
  canvas.height = Math.ceil(y);

  // ── 실제 그리기 ────────────────────────────────────────────────
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cardLeft = MARGIN;
  const cardRight = WIDTH - MARGIN;

  // 티켓 종이의 그림자. 화면의 --shadow-panel과 같은 세기로 맞춘다.
  ctx.save();
  ctx.shadowColor = 'rgba(28,25,23,0.07)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = PANEL;
  ticketPath(ctx, cardLeft, stubTop, cardRight, cardBottom, tearY);
  ctx.fill();
  ctx.restore();
  // 화면 패널과 같은 1px 테두리
  ctx.save();
  ctx.strokeStyle = 'rgba(28,25,23,0.05)';
  ctx.lineWidth = 1;
  ticketPath(ctx, cardLeft, stubTop, cardRight, cardBottom, tearY);
  ctx.stroke();
  ctx.restore();

  // 본권: 로그인·초대 화면과 같은 그라데이션
  ctx.save();
  ctx.beginPath();
  ctx.rect(cardLeft, stubTop, cardRight - cardLeft, tearY - stubTop);
  ctx.clip();
  ticketPath(ctx, cardLeft, stubTop, cardRight, cardBottom, tearY);
  const grad = ctx.createLinearGradient(cardLeft, stubTop, cardRight, tearY);
  grad.addColorStop(0, ACCENT);
  grad.addColorStop(0.48, ACCENT_DEEP);
  grad.addColorStop(1, STAY_INK);
  ctx.fillStyle = grad;
  ctx.fill();
  // 초대 화면 티켓과 같은 원형 하이라이트
  const cx = (cardLeft + cardRight) / 2;
  const cy = stubTop + (tearY - stubTop) * 0.4;
  const sheen = ctx.createRadialGradient(cx, cy, 0, cx, cy, (cardRight - cardLeft) * 0.62);
  sheen.addColorStop(0, 'rgba(255,255,255,0.32)');
  sheen.addColorStop(0.62, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fill();
  const edge = ctx.createLinearGradient(0, stubTop, 0, stubTop + 72);
  edge.addColorStop(0, 'rgba(255,255,255,0.18)');
  edge.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = edge;
  ctx.fill();
  // 길과 자동차: 출발지에서 도착지로 이어지는 국내 여행의 이동을 나타낸다.
  drawRoute(ctx, LEFT + 26, routeY - 26, RIGHT - 26, routeY - 26);
  ctx.restore();

  // 반권: 아주 옅은 세로 그라데이션으로 종이결을 준다
  ctx.save();
  ctx.beginPath();
  ctx.rect(cardLeft, tearY, cardRight - cardLeft, stubBottom - tearY);
  ctx.clip();
  ticketPath(ctx, cardLeft, stubTop, cardRight, cardBottom, tearY);
  const stub = ctx.createLinearGradient(0, tearY, 0, tearY + 130);
  stub.addColorStop(0, PANEL_2);
  stub.addColorStop(1, PANEL);
  ctx.fillStyle = stub;
  ctx.fill();
  // 소인: 여권 도장을 흉내 내지 않고 원 두 겹으로 옅게 둔다.
  drawPostmark(ctx, stampX, stampY, 42, font);
  ctx.restore();

  // 반권 끝을 나누는 선. 그 아래에 바코드와 티켓 번호가 나란히 선다.
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(LEFT, noRuleY);
  ctx.lineTo(RIGHT, noRuleY);
  ctx.stroke();
  drawBarcode(ctx, LEFT, barcodeY, INNER - 160, 22);

  // 절취선: 양옆 홈과 점선. 화면 티켓처럼 홈 안쪽에 옅은 그림자를 둔다.
  for (const [nx, dir] of [
    [cardLeft, -1],
    [cardRight, 1],
  ] as const) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(nx, tearY, NOTCH, 0, Math.PI * 2);
    ctx.fillStyle = GROUND;
    ctx.fill();
    ctx.clip();
    ctx.shadowColor = 'rgba(28,25,23,0.12)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = dir * -1;
    ctx.strokeStyle = 'rgba(28,25,23,0.06)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(nx, tearY, NOTCH, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(107,114,128,0.45)';
  ctx.lineWidth = 2;
  ctx.setLineDash([9, 8]);
  ctx.beginPath();
  ctx.moveTo(cardLeft + NOTCH + 12, tearY);
  ctx.lineTo(cardRight - NOTCH - 12, tearY);
  ctx.stroke();
  ctx.setLineDash([]);

  // 티켓과 일정 본문 사이 구분선
  if (!foldedAll && sections.length) {
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(LEFT, stubBottom + 26);
    ctx.lineTo(RIGHT, stubBottom + 26);
    ctx.stroke();
  }

  for (const draw of draws) {
    if (draw.kind === 'logo') {
      drawLogo(ctx, draw.x, draw.y, draw.color);
      continue;
    }
    setFont(draw.size, draw.bold);
    ctx.fillStyle = draw.color;
    ctx.textAlign = draw.align;
    ctx.fillText(draw.text, draw.x, draw.y);
  }
  ctx.textAlign = 'left';

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('이미지를 만들지 못했습니다. 다시 시도해 주세요.')),
      'image/png',
    ),
  );
}

/** 위아래 모서리가 둥글고 절취선 자리에 홈이 팬 티켓 외곽선. */
function ticketPath(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  right: number,
  bottom: number,
  tearY: number,
): void {
  ctx.beginPath();
  ctx.moveTo(left + RADIUS, top);
  ctx.lineTo(right - RADIUS, top);
  ctx.arcTo(right, top, right, top + RADIUS, RADIUS);
  ctx.lineTo(right, tearY - NOTCH);
  ctx.arc(right, tearY, NOTCH, -Math.PI / 2, Math.PI / 2, true);
  ctx.lineTo(right, bottom - RADIUS);
  ctx.arcTo(right, bottom, right - RADIUS, bottom, RADIUS);
  ctx.lineTo(left + RADIUS, bottom);
  ctx.arcTo(left, bottom, left, bottom - RADIUS, RADIUS);
  ctx.lineTo(left, tearY + NOTCH);
  ctx.arc(left, tearY, NOTCH, Math.PI / 2, -Math.PI / 2, true);
  ctx.lineTo(left, top + RADIUS);
  ctx.arcTo(left, top, left + RADIUS, top, RADIUS);
  ctx.closePath();
}

/** 출발점과 도착점을 잇는 점선 길. 가운데를 자동차가 달린다. */
function drawRoute(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  ctx.save();
  const midX = (x1 + x2) / 2;
  const ctrlY = y1 - 20;
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 7]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(midX, ctrlY, x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [x, y] of [
    [x1, y1],
    [x2, y2],
  ]) {
    ctx.beginPath();
    ctx.arc(x!, y!, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 반권 오른쪽의 옅은 소인. 여권 도장을 흉내 내지 않고 원 두 겹으로만 둔다. */
function drawPostmark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  font: string,
): void {
  ctx.save();
  // 손으로 찍은 것처럼 살짝 기울인다.
  ctx.translate(x, y);
  ctx.rotate(-0.14);
  ctx.strokeStyle = 'rgba(107,114,128,0.24)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([5, 6]);
  ctx.beginPath();
  ctx.arc(0, 0, r - 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(107,114,128,0.34)';
  ctx.textAlign = 'center';
  ctx.font = `700 14px ${font}`;
  ctx.fillText('좋은 여행', 0, 1);
  ctx.font = `400 9px ${font}`;
  ctx.fillText('TRIPLO', 0, 15);
  ctx.textAlign = 'left';
  ctx.restore();
}

/** 반권 아래 줄무늬. 굵기를 번갈아 두어 바코드처럼 보이게 한다. */
function drawBarcode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(107,114,128,0.55)';
  // 화면 티켓의 app-barcode와 같은 폭 배열을 쓴다.
  const widths = [3, 2, 1, 1, 2, 5, 2, 1, 4, 1, 3];
  let cursor = x;
  let i = 0;
  while (cursor < x + width) {
    const w = widths[i % widths.length]!;
    ctx.fillRect(cursor, y, w, height);
    cursor += w + 2;
    i++;
  }
  ctx.restore();
}

/** 로그인·초대 화면 티켓과 같은 로고 획. 20px 기준으로 그린다. */
function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  const s = 20 / 28;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.1 / s;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(6.5, 7.5);
  ctx.bezierCurveTo(9.8, 6.6, 14.6, 6.2, 19.5, 6.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(13.2, 6.9);
  ctx.bezierCurveTo(12.6, 12.4, 12.3, 16.6, 12.6, 19.2);
  ctx.bezierCurveTo(12.8, 21.1, 13.6, 21.9, 15.1, 21.6);
  ctx.bezierCurveTo(16.4, 21.3, 17.7, 20.3, 19, 18.6);
  ctx.stroke();
  ctx.restore();
}
