/**
 * 배지·안내 색의 글자/배경 대비가 WCAG AA(4.5:1)를 넘는지 확인한다.
 *
 * 색을 눈으로만 고르면 예쁘지만 읽기 어려운 조합이 남는다. 실제로
 * 2026-09-23 이전 값은 식사(4.42)와 오류(4.23)가 기준에 못 미쳤고,
 * 작은 글자라 더 불리한데도 아무도 알아차리지 못했다.
 *
 * theme.css를 직접 읽으므로 토큰을 고치면 이 검사만 다시 돌리면 된다.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../src/styles/theme.css'), 'utf-8');

/** 배지·안내처럼 글자를 얹는 색 쌍. 이름은 theme.css의 토큰 접두사다. */
const PAIRS = ['place', 'stay', 'region', 'meal', 'cafe', 'warn', 'danger', 'ok', 'accent'];

const token = (name) => {
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  return match ? match[1] : null;
};

const channels = (hex) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const luminance = (hex) => {
  const [r, g, b] = channels(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

let failed = 0;
for (const name of PAIRS) {
  // accent는 글자색이 accent-deep, 배경이 accent-tint다.
  const ink = token(name === 'accent' ? 'accent-deep' : `${name}-ink`);
  const tint = token(`${name}-tint`);
  if (!ink || !tint) {
    console.log(`${name}: 토큰을 찾지 못했습니다 (ink=${ink}, tint=${tint})`);
    failed++;
    continue;
  }
  const ratio = contrast(ink, tint);
  const ok = ratio >= 4.5;
  if (!ok) failed++;
  console.log(
    `${name.padEnd(8)} ${ink} on ${tint}  ${ratio.toFixed(2)}  ${ok ? '통과' : '미달(4.5 필요)'}`,
  );
}

console.log(failed ? `\n${failed}개가 기준에 미달합니다.` : '\n모든 조합이 AA를 통과합니다.');
process.exit(failed ? 1 : 0);
