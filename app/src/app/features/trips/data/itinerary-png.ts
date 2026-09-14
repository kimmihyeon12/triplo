import type { ItinerarySection } from '../util/itinerary-image';

/** Canvas text export avoids cross-origin map tiles and excludes private DOM content. */
export async function renderItineraryPng(
  title: string,
  sections: ItinerarySection[],
  includeCosts: boolean,
): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이 브라우저에서 이미지 저장을 사용할 수 없습니다.');
  const font = getComputedStyle(document.body).fontFamily;
  type Line = { text: string; x: number; y: number; size: number; bold: boolean; color: string };
  const lines: Line[] = [];
  let y = 68;
  const add = (text: string, size = 24, bold = false, color = '#16181d', x = 56) => {
    ctx.font = `${bold ? 700 : 400} ${size}px ${font}`;
    let line = '';
    for (const char of Array.from(text.replace(/\r/g, ''))) {
      if (char === '\n' || ctx.measureText(line + char).width > 888) {
        lines.push({ text: line, x, y, size, bold, color });
        y += size * 1.5;
        line = char === '\n' ? '' : char;
      } else line += char;
    }
    lines.push({ text: line, x, y, size, bold, color });
    y += size * 1.5;
  };
  add('TRIPLO · 여행 일정', 18, true, '#2f5fdb');
  y += 12;
  add(title, 38, true);
  y += 28;
  for (const section of sections) {
    add(section.title, 28, true, '#2f5fdb');
    y += 12;
    if (!section.rows.length) add('아직 등록한 일정이 없습니다.', 22, false, '#6b7280');
    for (const [index, row] of section.rows.entries()) {
      add(`${index + 1}. ${row.name}`, 26, true);
      if (row.detail) add(row.detail, 20, false, '#4a4f58');
      if (includeCosts)
        add(
          row.cost == null
            ? '예상 비용 미정'
            : `예상 ${row.cost.toLocaleString('ko-KR')}원${row.name.startsWith('숙소 ·') ? ' · 숙박 전체 기준' : ''}`,
          20,
          false,
          '#6b7280',
        );
      y += 20;
    }
    y += 32;
  }
  add('이동시간·영업정보는 별도로 확인해 주세요.', 18, false, '#6b7280');
  if (y > 16000)
    throw new Error('일정이 길어 한 장에 담기 어렵습니다. 날짜를 선택해 저장해 주세요.');
  canvas.height = Math.ceil(y + 40);
  ctx.fillStyle = '#fbfcfd';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const line of lines) {
    ctx.font = `${line.bold ? 700 : 400} ${line.size}px ${font}`;
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, line.x, line.y);
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('이미지를 만들지 못했습니다. 다시 시도해 주세요.')),
      'image/png',
    ),
  );
}
