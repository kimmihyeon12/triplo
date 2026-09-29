import { drawStrokes, fitSize, type HighlightStroke } from '../../util/image';

/*
 * 캔버스를 만들어 그리므로 브라우저가 있어야 한다. 순수 계산(fitSize·drawStrokes)은
 * util에 두고, 문서(document)를 쓰는 이 함수는 화면 곁에 둔다.
 */
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
