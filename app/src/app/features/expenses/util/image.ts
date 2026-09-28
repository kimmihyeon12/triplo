/**
 * 영수증 사진을 서버로 보내기 전에 줄이고 형광펜을 합성한다.
 *
 * 형광펜 좌표는 사진 크기에 대한 비율(0~1)로 둔다. 화면에 보이는 크기와
 * 보낼 크기가 달라도 같은 자리에 칠해진다.
 */

export interface HighlightStroke {
  /** 사진 너비·높이에 대한 비율 좌표. */
  readonly points: readonly { x: number; y: number }[];
}

/** 긴 변 한도. 영수증 글자를 읽기에 충분하고 요청은 1MB 안팎이 된다. */
export const MAX_EDGE = 1600;
/** 형광펜 굵기. 사진 너비에 대한 비율이며 영수증 한 줄을 덮는 정도다. */
export const STROKE_RATIO = 0.035;
const HIGHLIGHT = 'rgba(255, 221, 0, 0.45)';

/** 긴 변이 한도를 넘으면 비율을 유지해 줄인다. 작은 사진은 키우지 않는다. */
export function fitSize(width: number, height: number, max = MAX_EDGE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: readonly HighlightStroke[],
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.strokeStyle = HIGHLIGHT;
  ctx.lineWidth = width * STROKE_RATIO;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const stroke of strokes) {
    const [first, ...rest] = stroke.points;
    if (!first) continue;
    ctx.beginPath();
    ctx.moveTo(first.x * width, first.y * height);
    for (const p of rest.length ? rest : [first]) ctx.lineTo(p.x * width, p.y * height);
    ctx.stroke();
  }
  ctx.restore();
}

/** 줄이고 형광펜을 입힌 JPEG의 base64 본문을 돌려준다. */
export function renderReceipt(
  image: CanvasImageSource & { width: number; height: number },
  strokes: readonly HighlightStroke[],
): string {
  const { width, height } = fitSize(image.width, image.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('사진을 처리하지 못했어요.');
  // 투명 PNG 캡처가 JPEG에서 검게 나오지 않게 흰 바탕을 먼저 깐다.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  drawStrokes(ctx, strokes, width, height);
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1] ?? '';
}
