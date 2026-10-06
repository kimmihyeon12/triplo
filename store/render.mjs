// Play 스토어 등록 이미지를 만든다(2026-10-06).
// 1) 앱 화면 찍기:  cd app && npx playwright test --config=playwright.store.config.ts
// 2) 합성:          node store/render.mjs
// 결과: store/out/ 스크린샷 1080×1920 8장, 피처 그래픽 1024×500, 아이콘 512×512. 모두 알파 없는 PNG.
// 원칙: 한 장 한 메시지, 큰 글씨, 실제 앱 화면(흰색 기기)과 핵심 부분을 확대한 카드.
// 2026-10-06 사용자 선택(시안 B): 첫 두 장은 파란 배경, 나머지는 연한 배경, 모든 장을 잇는 도로 풍경.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, readdir, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('../app/node_modules/playwright');
const sharp = (() => { try { return require('../app/node_modules/sharp'); } catch { return null; } })();

const HERE = dirname(fileURLToPath(import.meta.url));
const BUILD = join(HERE, '.build');
const SCREENS = join(HERE, 'screens');
const screenUrl = (name) => pathToFileURL(join(SCREENS, `${name}.png`)).href;
const { viewport: VP, focus: FOCUS } = JSON.parse(await readFile(join(SCREENS, 'focus.json'), 'utf8'));

// 잰 자리를 확대에 맞게 다듬는다: 지도는 범례를 빼고, 영수증은 사진 속 종이만 남긴다.
const TRIM = {
  trip: (f) => ({ ...f, h: f.h - 44, r: 16 }),
  receipt: (f) => ({ ...f, x: f.x + 14, w: f.w - 28, y: f.y + f.h * 0.17, h: f.h * 0.6, r: 0 }),
};
for (const [k, fn] of Object.entries(TRIM)) if (FOCUS[k]) FOCUS[k] = fn(FOCUS[k]);

const C = { deep: '#2f5fdb', deeper: '#2550c4', tint: '#eef3fe', paper: '#f5f7fb', ink: '#14213d', accent: '#2f5fdb' };

const SLIDES = [
  { file: '00-hero', hero: true },
  { file: '01-plan', screen: 'plan-result', eyebrow: 'AI 일정 짜기', title: '고른 곳만 담는<br>여행 일정' },
  { file: '02-trip', screen: 'trip', eyebrow: '날짜별 일정 · 지도', title: '동선이 한눈에<br>보이는 여행' },
  { file: '03-map', screen: 'map-explore', eyebrow: '지도에서 담기', title: '지도에서 보고<br>바로 담기' },
  { file: '04-chat', screen: 'chat', eyebrow: 'AI 챗봇', title: '말 한마디로<br>일정 고치기' },
  { file: '05-receipt', screen: 'receipt', eyebrow: '영수증 인식', title: '영수증 사진으로<br>지출 입력' },
  { file: '06-expenses', screen: 'expenses', eyebrow: '가계부 · 정산', title: '같이 쓴 돈도<br>깔끔하게 정산' },
  { file: '07-invite', screen: 'invite', eyebrow: '친구 초대', title: '링크 하나로<br>함께 짜는 여행' },
];

/**
 * 배치. 흰색 기기를 가운데 두고 핵심 부분을 확대한 카드를 띄운다.
 * - phone: 기기 화면 폭(px)·위쪽 위치·가로 중심
 * - zoom: 확대 카드 폭(px)·가로 중심
 * - bg(i): 장마다 배경. dark면 글자를 흰색으로
 */
const LAYOUT = {
  phone: { w: 660, top: 520, cx: 540 },
  zoom: { w: 920, cx: 540 },
  bg: (i) => (i < 2 ? { color: C.deep, dark: true } : { color: C.tint, dark: false }),
};

const FONT = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css">`;

const BASE_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Pretendard Variable',Pretendard,sans-serif;-webkit-font-smoothing:antialiased;letter-spacing:-0.02em}
  .slide{position:relative;width:1080px;height:1920px;overflow:hidden}
  .eyebrow{display:inline-block;font-size:34px;font-weight:700;padding:12px 28px;border-radius:999px}
  .title{margin-top:30px;font-size:84px;line-height:1.2;font-weight:800;letter-spacing:-0.035em}
  .phone{position:absolute;padding:14px;border-radius:80px;background:#fff;
    box-shadow:0 0 0 2px #e4e8ef inset,0 0 0 1px rgba(20,33,61,.06),0 50px 110px rgba(20,40,90,.16),0 14px 34px rgba(20,40,90,.10)}
  .phone::before{content:'';position:absolute;right:-5px;top:300px;width:5px;height:120px;border-radius:0 4px 4px 0;background:#e4e8ef}
  .screen{position:relative;border-radius:66px;overflow:hidden;background:#fff;box-shadow:0 0 0 1px #edf0f5}
  .status{height:56px;display:flex;align-items:center;justify-content:space-between;padding:6px 44px 0;font-size:24px;font-weight:600;color:#14213d;background:#fff}
  .status .icons{display:flex;gap:10px;align-items:center}
  .cam{position:absolute;left:50%;top:17px;width:24px;height:24px;margin-left:-12px;border-radius:50%;background:#1b1e24}
  .screen img{display:block;width:100%}
  .zoom{position:absolute;overflow:hidden;background-repeat:no-repeat;background-color:#fff;
    box-shadow:0 0 0 1px rgba(20,33,61,.06),0 40px 90px rgba(20,40,90,.22),0 10px 24px rgba(20,40,90,.12)}
`;

const STATUS = `<div class="status"><span>10:10</span><span class="icons">
  <svg width="30" height="22" viewBox="0 0 30 22"><path d="M2 20h4v-5H2zM9 20h4v-9H9zM16 20h4V7h-4zM23 20h4V2h-4z" fill="#14213d"/></svg>
  <svg width="40" height="22" viewBox="0 0 40 22"><rect x="1" y="3" width="33" height="16" rx="4" fill="none" stroke="#14213d" stroke-width="2"/><rect x="4" y="6" width="24" height="10" rx="2" fill="#14213d"/><rect x="36" y="8" width="3" height="6" rx="1.5" fill="#14213d"/></svg>
</span></div><span class="cam"></span>`;

const PAD = 14;
const STATUS_H = 56;


// 배경: 모든 장을 가로지르는 한 줄 도로. 장을 넘기면 도로와 풍경이 이어진다.
// 기기가 가운데를 덮으므로 자동차·나무·핀은 양옆 여백(0~200, 880~1080)에 둔다.
// 도로 색은 파란 장과 연한 장 모두에 맞는 한 가지로 써서 장 경계에서 끊기지 않게 한다.
const SCENE_W = 1080 * 8;
const roadY = (x) => 1560 + 120 * Math.sin(x / 520) + 60 * Math.sin(x / 190);
const roadSlope = (x) => (120 / 520) * Math.cos(x / 520) + (60 / 190) * Math.cos(x / 190);
const ROAD = { fill: '#86a3f0', edge: 'rgba(255,255,255,.55)', dash: '#ffffff', tree: '#5cc794', tree2: '#48b583', pin: '#ff7a59' };
function car(x, color, flip) {
  const y = roadY(x);
  const a = (Math.atan(roadSlope(x)) * 180) / Math.PI;
  return `<g transform="translate(${x} ${y - 6}) rotate(${a}) scale(${flip ? -1 : 1} 1)">
    <ellipse cx="0" cy="34" rx="62" ry="9" fill="rgba(0,0,0,.14)"/>
    <rect x="-64" y="-18" width="128" height="44" rx="16" fill="${color}"/>
    <path d="M-34 -18 L-20 -44 H22 L40 -18 Z" fill="${color}"/>
    <path d="M-25 -20 L-15 -38 H-2 V-20 Z M4 -20 V-38 H18 L31 -20 Z" fill="#d9ecff"/>
    <rect x="50" y="-6" width="12" height="9" rx="3" fill="#ffe28a"/>
    <circle cx="-36" cy="27" r="14" fill="#1b2340"/><circle cx="-36" cy="27" r="6" fill="#c9d3ea"/>
    <circle cx="36" cy="27" r="14" fill="#1b2340"/><circle cx="36" cy="27" r="6" fill="#c9d3ea"/>
  </g>`;
}
function tree(x, y, s, c) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-5" y="0" width="10" height="34" rx="4" fill="#8a6a4b"/>
    <circle cx="0" cy="-14" r="30" fill="${c}"/><circle cx="-18" cy="2" r="20" fill="${c}"/><circle cx="18" cy="2" r="20" fill="${c}"/></g>`;
}
// 반투명 원이 겹친 자리가 진해지지 않도록 흰색으로 그리고 묶음 전체에 투명도를 준다.
function cloud(x, y, s, o) {
  return `<g transform="translate(${x} ${y}) scale(${s})" fill="#fff" opacity="${o}"><circle cx="0" cy="0" r="34"/><circle cx="40" cy="-14" r="44"/><circle cx="86" cy="0" r="32"/><rect x="0" y="0" width="86" height="32"/></g>`;
}
function pin(x, y, c) {
  return `<g transform="translate(${x} ${y})"><path d="M0 0 C-26 -30 -26 -62 0 -62 C26 -62 26 -30 0 0Z" fill="${c}"/><circle cx="0" cy="-40" r="9" fill="#fff"/></g>`;
}
function scene(i, dark) {
  const P = ROAD;
  const road = [];
  for (let x = -200; x <= SCENE_W + 200; x += 16) road.push(`${x},${roadY(x).toFixed(1)}`);
  const pts = road.join(' ');
  const mtn = dark ? 'rgba(255,255,255,.08)' : 'rgba(47,95,219,.08)';
  const mtn2 = dark ? 'rgba(255,255,255,.05)' : 'rgba(47,95,219,.05)';
  const hills = [];
  for (let k = 0; k < 24; k++) {
    const x = k * 380 - 100;
    hills.push(`<path d="M${x} 1560 L${x + 220} ${1290 + (k % 3) * 40} L${x + 460} 1560Z" fill="${k % 2 ? mtn : mtn2}"/>`);
  }
  const deco = [];
  const carColors = ['#ffffff', '#ffd54a', '#ff8a65', '#7fd3c3', '#ffffff', '#ffb4c8', '#ffd54a', '#9ec5ff'];
  for (let k = 0; k < 8; k++) {
    const base = k * 1080;
    deco.push(car(base + 110 + (k % 2) * 20, carColors[k], k % 2 === 1));
    deco.push(car(base + 975 - (k % 3) * 15, carColors[(k + 3) % 8], k % 2 === 0));
    deco.push(tree(base + 60, roadY(base + 60) - 120, 0.9, P.tree));
    deco.push(tree(base + 1030, roadY(base + 1030) + 140, 1.0, P.tree2));
    deco.push(pin(base + 170, roadY(base + 170) + 170, P.pin));
    deco.push(cloud(base + 40, 520 + (k % 3) * 60, 0.9, dark ? 0.16 : 0.95));
    deco.push(cloud(base + 900, 760 - (k % 2) * 90, 0.7, dark ? 0.12 : 0.85));
  }
  return `<svg width="1080" height="1920" viewBox="${i * 1080} 0 1080 1920" style="position:absolute;inset:0">
    ${hills.join('')}
    <polyline points="${pts}" fill="none" stroke="${P.edge}" stroke-width="150" stroke-linejoin="round" stroke-linecap="round"/>
    <polyline points="${pts}" fill="none" stroke="${P.fill}" stroke-width="130" stroke-linejoin="round" stroke-linecap="round"/>
    <polyline points="${pts}" fill="none" stroke="${P.dash}" stroke-width="7" stroke-dasharray="34 30" stroke-linecap="round"/>
    ${deco.join('')}
  </svg>`;
}


// 기능 아이콘(선 아이콘, 24 격자)
const FEATURES = [
  ['AI 일정', '<path d="M12 3l1.8 4.6L18.5 9.5l-4.7 1.9L12 16l-1.8-4.6L5.5 9.5l4.7-1.9z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>'],
  ['지도', '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>'],
  ['가계부', '<rect x="3.5" y="6" width="17" height="13" rx="2.5"/><path d="M3.5 10h17"/><path d="M15.5 14.5h2"/><path d="M7 6V4.5h10V6"/>'],
  ['친구와 함께', '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="16.8" cy="9.5" r="2.5"/><path d="M16 14.6c2.5-.2 4.2 1.3 4.6 4.4"/>'],
];

// 첫 장: 앱 아이콘·이름·한 줄 소개·기능 아이콘과 앱 화면
function hero(i) {
  const bg = LAYOUT.bg(i);
  const dark = bg.dark;
  const fg = dark ? '#fff' : C.ink;
  const tile = dark ? 'background:rgba(255,255,255,.14);color:#fff' : `background:#fff;color:${C.accent};box-shadow:0 0 0 1px rgba(47,95,219,.10),0 10px 24px rgba(20,40,90,.08)`;
  const icon = dark ? join(BUILD, 'icon-white.svg') : join(BUILD, 'icon-square.svg');
  const sw = 600;
  const feats = FEATURES.map(([label, d]) => `<div style="display:flex;flex-direction:column;align-items:center;gap:16px;width:190px">
      <div style="width:104px;height:104px;border-radius:32px;display:flex;align-items:center;justify-content:center;${tile}">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg></div>
      <span style="font-size:30px;font-weight:700;color:${fg}">${label}</span></div>`).join('');
  return `<div class="slide" style="background:${bg.color}">
    ${scene(i, dark)}
    <div style="position:absolute;left:0;right:0;top:116px;text-align:center">
      <img src="${pathToFileURL(icon).href}" style="width:168px;height:168px;border-radius:40px;box-shadow:0 22px 50px rgba(10,25,70,${dark ? '.35' : '.22'})">
      <div style="margin-top:30px;font-size:46px;font-weight:800;letter-spacing:-0.03em;color:${fg}">트립플로</div>
      <h1 style="margin-top:22px;font-size:80px;line-height:1.2;font-weight:800;letter-spacing:-0.04em;color:${fg}">고른 곳만 담는<br>국내 여행 비서</h1>
      <div style="margin-top:56px;display:flex;justify-content:center;gap:12px">${feats}</div>
    </div>
    <div class="phone" style="left:${540 - sw / 2 - PAD}px;top:960px;width:${sw + PAD * 2}px">
      <div class="screen">${STATUS}<img src="${screenUrl('trip')}"></div></div>
  </div>`;
}

function slide(s, i) {
  if (s.hero) return hero(i);
  const v = LAYOUT;
  const bg = v.bg(i);
  const fg = bg.dark ? '#fff' : C.ink;
  const pill = bg.dark ? 'background:rgba(255,255,255,.16);color:#fff' : `background:#fff;color:${C.accent};box-shadow:0 0 0 1px rgba(47,95,219,.12)`;
  const copy = `<div style="position:absolute;left:0;right:0;top:112px;text-align:center">`;

  // 기기: 화면 폭 sw, 앱 화면 1 CSS px = k 화면 px
  const sw = v.phone.w;
  const k = sw / VP.width;
  const left = v.phone.cx - sw / 2 - PAD;
  const phone = `<div class="phone" style="left:${left}px;top:${v.phone.top}px;width:${sw + PAD * 2}px">
    <div class="screen">${STATUS}<img src="${screenUrl(s.screen)}"></div></div>`;

  // 확대 카드: 기기 안 같은 자리에서 시작해 크게 띄운다. 화면 밖으로 나가지 않게 세로 위치를 맞춘다.
  let zoom = '';
  const f = FOCUS[s.screen];
  if (f) {
    // 세로로 긴 자리(영수증 사진 등)는 카드가 기기를 다 덮지 않게 높이를 720px까지로 줄인다.
    const z = Math.min(v.zoom.w / f.w, 720 / f.h);
    const zw = f.w * z;
    const zh = f.h * z;
    const inPhoneY = v.phone.top + PAD + STATUS_H + (f.y + f.h / 2) * k;
    const top = Math.max(v.phone.top + 60, Math.min(1830 - zh, inPhoneY - zh / 2));
    const radius = Math.max(28, (f.r || 16) * z * 0.9);
    zoom = `<div class="zoom" style="left:${v.zoom.cx - zw / 2}px;top:${top}px;width:${zw}px;height:${zh}px;border-radius:${radius}px;
      background-image:url('${screenUrl(s.screen)}');background-size:${VP.width * z}px auto;background-position:${-f.x * z}px ${-f.y * z}px"></div>`;
  }

  return `<div class="slide" style="background:${bg.color}">
    ${scene(i, bg.dark)}
    ${copy}<span class="eyebrow" style="${pill}">${s.eyebrow}</span><h1 class="title" style="color:${fg}">${s.title}</h1></div>
    ${phone}${zoom}
  </div>`;
}

function featureGraphic() {
  return `<div style="position:relative;width:1024px;height:500px;background:${C.deep};overflow:hidden;color:#fff">
    <div style="position:absolute;left:72px;top:112px">
      <div style="display:flex;align-items:center;gap:18px">
        <img src="${pathToFileURL(join(BUILD, 'icon-white.svg')).href}" style="width:76px;height:76px;border-radius:20px">
        <span style="font-size:52px;font-weight:800;letter-spacing:-0.04em">트립플로</span>
      </div>
      <div style="margin-top:34px;font-size:46px;font-weight:800;line-height:1.25;letter-spacing:-0.035em">고른 곳만 담는<br>국내 여행 일정</div>
      <div style="margin-top:18px;font-size:24px;font-weight:500;opacity:.85">AI 추천 · 지도 · 가계부 · 친구와 함께</div>
    </div>
    <div style="position:absolute;left:630px;top:64px;width:330px;padding:8px;border-radius:46px;background:#fff;box-shadow:0 30px 60px rgba(10,25,70,.35)">
      <div style="border-radius:38px;overflow:hidden;background:#fff;height:620px"><img src="${screenUrl('trip')}" style="width:100%;display:block"></div>
    </div>
  </div>`;
}

const MARK = `<g transform="translate(146 146) scale(7.86)" fill="none" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6.5 7.5C9.8 6.6 14.6 6.2 19.5 6.6M13.2 6.9C12.6 12.4 12.3 16.6 12.6 19.2C12.8 21.1 13.6 21.9 15.1 21.6C16.4 21.3 17.7 20.3 19 18.6"/></g>`;
// Play 아이콘은 정사각형 전체를 채운다(둥근 모서리는 스토어가 입힌다).
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" fill="${C.deep}"/>${MARK.replace('fill="none"', 'fill="none" stroke="#ffffff"')}</svg>`;
const ICON_WHITE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" fill="#ffffff"/>${MARK.replace('fill="none"', `fill="none" stroke="${C.deep}"`)}</svg>`;

async function render(page, html, w, h, path) {
  const file = join(BUILD, 'page.html');
  await writeFile(file, `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>${BASE_CSS}html,body{width:${w}px;height:${h}px}</style></head><body>${html}</body></html>`);
  await page.setViewportSize({ width: w, height: h });
  await page.goto(pathToFileURL(file).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path, type: 'png' });
}

async function stripAlpha(dir) {
  // Play는 알파 채널이 있는 스크린샷을 거절한다.
  if (!sharp) return;
  for (const f of await readdir(dir)) {
    if (!f.endsWith('.png')) continue;
    const p = join(dir, f);
    await sharp(p).removeAlpha().png().toFile(p + '.tmp');
    await rename(p + '.tmp', p);
  }
}

const OUT = join(HERE, 'out');
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await mkdir(BUILD, { recursive: true });
await writeFile(join(BUILD, 'icon-white.svg'), ICON_WHITE);
await writeFile(join(BUILD, 'icon-square.svg'), ICON_SVG);

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [i, s] of SLIDES.entries()) await render(page, slide(s, i), 1080, 1920, join(OUT, `${s.file}.png`));
await render(page, featureGraphic(), 1024, 500, join(OUT, 'feature-graphic.png'));
await render(page, ICON_SVG, 512, 512, join(OUT, 'icon-512.png'));
await stripAlpha(OUT);
await browser.close();
console.log('done', OUT);
