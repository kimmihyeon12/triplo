/**
 * 알림 아이콘을 앱 아이콘(SVG)에서 PNG로 만든다. 알림은 SVG를 보여 주지 못하는 브라우저가 있다.
 *   node scripts/build-notification-icons.mjs
 * 앱 아이콘을 바꾸면 다시 돌린다.
 */
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svg = await readFile(resolve(root, 'public/brand/triplo-app-icon.svg'), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size] of [['notification-192.png', 192], ['notification-badge-96.png', 96]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px">${svg.replace('<svg', `<svg width="${size}" height="${size}"`)}</div></body></html>`,
  );
  await page.screenshot({ path: resolve(root, 'public/icons', name), omitBackground: true });
  console.log('wrote', name);
}
await browser.close();
