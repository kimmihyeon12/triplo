/**
 * 탑승권 표기에 쓰는 티켓 번호. 여행 id에서 결정적으로 뽑아내므로
 * 저장값을 늘리지 않고도 같은 여행이면 언제나 같은 번호가 나온다.
 * 실제 예약번호가 아니며 외부에 조회할 수 있는 값도 아니다.
 */

/** 눈으로 옮겨 적을 때 헷갈리는 I·O·0·1을 뺀 32자. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BLOCK = 4;
const BLOCKS = 2;

/** 32비트 FNV-1a. id 한 글자만 달라져도 번호 전체가 달라진다. */
function hash32(value: string, seed: number): number {
  let h = seed;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function ticketNo(tripId: string): string {
  const blocks: string[] = [];
  for (let b = 0; b < BLOCKS; b++) {
    // 블록마다 다른 시드를 써서 앞뒤 네 자리가 같은 값으로 겹치지 않게 한다.
    let h = hash32(tripId, 0x811c9dc5 + b * 0x9e3779b9);
    let block = '';
    for (let i = 0; i < BLOCK; i++) {
      block += ALPHABET[h % ALPHABET.length];
      h = Math.floor(h / ALPHABET.length) || hash32(block, h);
    }
    blocks.push(block);
  }
  return `TR-${blocks.join('-')}`;
}
