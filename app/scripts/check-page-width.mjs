/**
 * 페이지 폭을 숫자로 정하지 않았는지 확인한다.
 *
 * 페이지 폭은 기본 --content-max(940px) 하나이고, 초대장·긴 글 본문·챗봇 대화만
 * --content-narrow(640px)를 쓴다(DESIGN.md 페이지 폭). 화면마다 폭을 따로 정하다 보니
 * 2026-09-30에 420·600·640·672·720·960px 여섯 가지가 섞여, 웹에서 화면을 옮길 때마다
 * 폭이 바뀌었다.
 *
 * 480px 이상을 숫자로 정한 max-w 클래스를 막는다. 카드 같은 부품(로그인 카드 420px)은
 * 페이지 안에서 좁히는 것이라 허용한다. 실험실(/lab)은 예제 화면이라 검사하지 않는다.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../src/app');
const NAMED = new Set(['xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', 'screen-md', 'screen-lg', 'screen-xl']);

function* htmlFiles(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== 'lab') yield* htmlFiles(path);
    } else if (name.endsWith('.html')) yield path;
  }
}

const errors = [];
for (const file of htmlFiles(root)) {
  const lines = readFileSync(file, 'utf-8').split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const [, value] of line.matchAll(/\bmax-w-([\w-]+|\[[^\]]+\])/g)) {
      const px = /^\d+$/.test(value)
        ? Number(value) * 4
        : /^\[(\d+)px\]$/.test(value)
          ? Number(value.slice(1, -3))
          : NAMED.has(value)
            ? Infinity
            : 0;
      if (px >= 480)
        errors.push(`${relative(root, file)}:${i + 1}: max-w-${value} — 페이지 폭은 max-w-(--content-max) 또는 max-w-(--content-narrow)로 정한다`);
    }
  });
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('페이지 폭을 토큰으로만 정합니다.');
