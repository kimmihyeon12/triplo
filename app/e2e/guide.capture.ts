import { expect, test, type Locator, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { GUIDE_SLIDES } from '../src/app/features/guide/model/guide';
import { addStop, createTrip, resetApp } from './helpers';

/**
 * 앱 사용법의 캡처와 밝게 남길 자리를 만든다(2026-10-01).
 * 테스트 앱의 고정 데이터만 쓰므로 실제 사용자 정보가 들어가지 않는다. 화면이 바뀌면 다시 돌린다:
 *   npx playwright test --config=playwright.capture.config.ts
 * 결과: public/guide/<장 이름>.jpg, src/app/features/guide/model/guide-marks.ts(밝게 남길 자리)
 * 설명 글은 GUIDE_SLIDES의 spots에 있고, 여기서는 그 순서 번호로 자리만 잰다.
 * 실제 휴대폰 크기(390×844)로, 선명하게 2배 해상도·높은 품질로 찍는다. 사용법 화면은 스크롤 없이 한 화면에 맞춰 줄여 보여 준다.
 */
const OUT = 'public/guide';
const W = 390;
const H = 844;

interface Mark { spot: number; x: number; y: number; w: number; h: number; r: number }
const marks: Record<string, Mark[]> = {};

/** 사용자에게 보일 안내이므로 테스트 데이터의 표시를 화면 글자에서만 지운다. 앱 코드는 바꾸지 않는다. */
async function tidy(page: Page): Promise<void> {
  await page.evaluate(() => {
    const swaps: [RegExp, string][] = [
      [/테스트용\s*추천 이유:\s*/g, ''],
      [/테스트용\s*/g, ''],
      [/\s*예시(?=[)\s]|$)/g, ''],
      // '테스트용 무료 예시'를 지우면 '무료 (무료)'가 남는다. 앱처럼 괄호를 뺀다.
      [/ (\S+) \(\1\)/g, ' $1'],
      [/강릉 테스트 호텔/g, '경포 바다 호텔'],
      [/테스트 픽스처/g, '카카오'],
      [/http:\/\/localhost:4300/g, 'https://triplo.pages.dev'],
      [/이 기기에 저장 · 친구와 공유되지 않습니다/g, ''],
    ];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      let text = node.textContent ?? '';
      for (const [from, to] of swaps) text = text.replace(from, to);
      if (text !== node.textContent) node.textContent = text;
    }
  });
}

/**
 * 밝게 남길 자리를 잰다. 화면 비율(%)로 남겨 어떤 크기로 보여도 맞게 한다.
 * 찾지 못하거나 화면 밖이면 건너뛴다(캡처는 계속한다).
 */
async function mark(slide: string, spot: number, target: Locator, overflow?: Locator): Promise<void> {
  if (!GUIDE_SLIDES.find((s) => s.key === slide)?.spots[spot]) throw new Error(`${slide}의 ${spot}번 설명이 없다`);
  const box = await target.first().boundingBox({ timeout: 3000 }).catch(() => null);
  if (!box) return;
  // 버튼 위로 올라온 펭이도 사용법의 밝은 영역에 함께 포함한다.
  const extra = await overflow?.first().boundingBox();
  if (extra) {
    const right = Math.max(box.x + box.width, extra.x + extra.width);
    const bottom = Math.max(box.y + box.height, extra.y + extra.height);
    box.x = Math.min(box.x, extra.x);
    box.y = Math.min(box.y, extra.y);
    box.width = right - box.x;
    box.height = bottom - box.y;
  }
  // 밝힌 자리의 테두리를 요소와 같은 중심으로 둥글리려고 요소의 모서리 둥글기를 읽는다.
  const r = await target.first().evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0);
  const x = Math.max(0, box.x);
  const y = Math.max(0, box.y);
  const w = Math.min(W, box.x + box.width) - x;
  const h = Math.min(H, box.y + box.height) - y;
  if (w < 8 || h < 8) return;
  // 소수 둘째 자리까지 남겨 보여 줄 때 1px 안쪽으로 맞춘다.
  const pct = (v: number, total: number) => Math.round((v / total) * 10000) / 100;
  (marks[slide] ??= []).push({ spot, x: pct(x, W), y: pct(y, H), w: pct(w, W), h: pct(h, H), r: Math.round(Math.min(r, box.height / 2)) });
}

async function shot(page: Page, slide: string): Promise<void> {
  await tidy(page);
  // 떠 있는 AI 챗봇 버튼은 첫 장에서만 소개한다. 다른 장에서는 설명할 버튼을 가린다.
  if (slide !== 'trips') {
    await page.evaluate(() => document.querySelectorAll<HTMLElement>('[data-testid=open-chat]').forEach((el) => (el.style.visibility = 'hidden')));
  }
  await page.screenshot({ path: `${OUT}/${slide}.jpg`, type: 'jpeg', quality: 92, animations: 'disabled' });
}

/** 영수증 사진을 그 자리에서 그린다. 고정 인식 결과(생수·과자·맥주·할인)와 같은 품목이다. */
async function receiptImage(page: Page): Promise<Buffer> {
  const other = await page.context().newPage();
  await other.setViewportSize({ width: 360, height: 520 });
  await other.setContent(`<body style="margin:0;background:#e9e6df;display:flex;justify-content:center;align-items:center;height:520px;font-family:monospace">
    <div style="width:280px;background:#fff;padding:22px 20px;box-shadow:0 2px 8px rgba(0,0,0,.15);font-size:14px;line-height:1.7;color:#222">
      <div style="text-align:center;font-weight:bold;font-size:16px">바다마트 강릉점</div>
      <div style="text-align:center;font-size:12px;color:#666">2026-10-10 15:42</div>
      <hr style="border:0;border-top:1px dashed #999">
      <div style="display:flex;justify-content:space-between"><span>생수 2L</span><span>1,500</span></div>
      <div style="display:flex;justify-content:space-between"><span>과자</span><span>3,200</span></div>
      <div style="display:flex;justify-content:space-between"><span>맥주</span><span>4,800</span></div>
      <div style="display:flex;justify-content:space-between"><span>할인</span><span>-1,000</span></div>
      <hr style="border:0;border-top:1px dashed #999">
      <div style="display:flex;justify-content:space-between;font-weight:bold"><span>합계</span><span>8,500</span></div>
    </div></body>`);
  const png = await other.screenshot({ type: 'png' });
  await other.close();
  return png;
}

test.use({ viewport: { width: W, height: H }, hasTouch: true, deviceScaleFactor: 2 });

test('사용법 캡처', async ({ page, context }) => {
  test.setTimeout(300_000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await resetApp(page);

  // 여행 목록
  await createTrip(page, { title: '속초 가을 여행', start: '2026-11-07', end: '2026-11-08', regions: ['속초시'] });
  await createTrip(page, { title: '부산 겨울 여행', start: '2026-12-19', end: '2026-12-20', regions: ['부산'] });
  await page.goto('/trips');
  await expect(page.getByText('속초 가을 여행')).toBeVisible();
  await mark('trips', 0, page.getByTestId('new-trip-ai'));
  await mark('trips', 1, page.getByTestId('new-trip'));
  await mark('trips', 2, page.getByTestId('trip-list').locator('a, [role=link], article').first());
  await mark('trips', 3, page.getByTestId('open-chat'), page.getByTestId('open-chat').locator('img'));
  await mark('trips', 4, page.getByTestId('go-stats'));
  await mark('trips', 5, page.getByTestId('open-join-paste'));
  await shot(page, 'trips');

  // 일정 짜기 조건
  await page.goto('/trips/ai');
  await page.getByTestId('ai-region-input').fill('강릉');
  await page.getByTestId('ai-region-match-강릉시').click();
  await page.getByTestId('ai-region-input').fill('속초');
  await page.getByTestId('ai-region-match-속초시').click();
  await page.getByTestId('ai-start').fill('2026-10-10');
  await page.getByTestId('ai-end').fill('2026-10-11');
  // 입력칸 선택 표시를 빼고 찍는다.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.evaluate(() => window.scrollTo(0, 0));
  await mark('plan-input', 0, page.getByTestId('ai-region-input'));
  await mark('plan-input', 1, page.getByTestId('ai-region-list'));
  await mark('plan-input', 2, page.getByTestId('ai-period-input').or(page.getByTestId('ai-start')));
  await mark('plan-input', 3, page.getByTestId('ai-next-1'));
  await shot(page, 'plan-input');

  // 일정 짜기 결과: 첫 코스 카드가 위에 오도록 맞춘다.
  await page.getByTestId('ai-next-1').click();
  await page.getByTestId('ai-next-2').click();
  await page.getByTestId('ai-next-3').click();
  await page.getByTestId('ai-generate').click();
  const result = page.getByTestId('ai-result');
  await expect(result).toBeVisible();
  const firstStop = result.getByRole('checkbox').nth(1);
  await firstStop.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -110));
  await page.waitForTimeout(300);
  await mark('plan-result', 0, firstStop);
  await mark('plan-result', 1, result.getByText('AI 추정').first());
  await mark('plan-result', 2, result.getByRole('combobox').first());
  await mark('plan-result', 3, page.getByTestId('ai-commit'));
  await shot(page, 'plan-result');

  // 담은 여행의 상세. 테스트 앱에는 지도 타일이 없어 땅과 바다를 그려 넣는다(캡처 화면에서만, 앱 코드는 그대로).
  await page.getByTestId('ai-commit').click();
  await expect(page.getByTestId('trip-header')).toBeVisible();
  const id = new URL(page.url()).pathname.split('/')[2]!;
  await page.waitForTimeout(1200);
  const map = page.getByTestId('trip-map').locator('.canvas').first();
  await map.evaluate((el) => {
    (el as HTMLElement).style.background = [
      'radial-gradient(120% 90% at 108% 0%, var(--color-map-water-light) 0 40%, transparent 40.5%)',
      'linear-gradient(160deg, transparent 0 46%, rgba(255,255,255,.95) 46% 47.4%, transparent 47.4%)',
      'linear-gradient(70deg, transparent 0 58%, rgba(255,255,255,.95) 58% 59.2%, transparent 59.2%)',
      'var(--color-map-land)',
    ].join(',');
  });
  await mark('trip', 0, page.getByRole('tab').filter({ hasText: '1일차' }));
  await mark('trip', 1, map);
  await mark('trip', 2, page.getByTestId('sort-nearest'));
  await mark('trip', 3, page.getByTestId('add-open'));
  await mark('trip', 4, page.getByTestId('go-expenses'));
  await mark('trip', 5, page.getByTestId('open-map-explore'));
  await shot(page, 'trip');

  // 지도에서 담기(큰 지도). 테스트 지도에는 타일이 없어 여행 상세처럼 땅과 바다를 그려 넣는다.
  await page.goto(`/trips/${id}/map`);
  await expect(page.getByTestId('map-explore')).toBeVisible();
  await page.getByTestId('trip-map').locator('.canvas').first().evaluate((el) => {
    (el as HTMLElement).style.background = [
      'radial-gradient(120% 90% at 108% 0%, var(--color-map-water-light) 0 40%, transparent 40.5%)',
      'linear-gradient(160deg, transparent 0 46%, rgba(255,255,255,.95) 46% 47.4%, transparent 47.4%)',
      'linear-gradient(70deg, transparent 0 58%, rgba(255,255,255,.95) 58% 59.2%, transparent 59.2%)',
      'var(--color-map-land)',
    ].join(',');
  });
  await page.getByTestId('map-category-meal').click();
  await page.getByTestId('map-rating-4').click();
  const pin = page.locator('[data-testid^=map-place-]').first();
  await pin.click();
  await expect(page.getByTestId('map-explore-sheet')).toBeVisible();
  await expect(page.getByTestId('map-explore-rating')).toBeVisible();
  await mark('map-explore', 0, page.getByTestId('map-search'));
  await mark('map-explore', 1, page.getByTestId('map-category-meal').locator('xpath=..'));
  await mark('map-explore', 2, page.getByTestId('map-rating-4').locator('xpath=..'));
  await mark('map-explore', 3, page.getByTestId('map-zoom-in').locator('xpath=../..'));
  await mark('map-explore', 4, pin.locator('xpath=..'));
  await mark('map-explore', 5, page.getByTestId('map-explore-add'));
  await shot(page, 'map-explore');

  // 지도 링크로 담기(장소 추가 화면). 찾기는 누르지 않고 링크를 붙여 넣은 상태로 찍는다.
  await page.goto(`/trips/${id}/stops/new`);
  await page.getByTestId('place-link-toggle').click();
  await page.getByTestId('place-link-url').fill('https://naver.me/5Qsr0ejg');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.getByTestId('place-link-toggle').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  await mark('place-link', 0, page.getByTestId('place-link-toggle'));
  await mark('place-link', 1, page.getByTestId('place-link-url'));
  await mark('place-link', 2, page.getByTestId('place-link-paste'));
  await mark('place-link', 3, page.getByTestId('place-link-find'));
  await shot(page, 'place-link');
  await page.goto(`/trips/${id}`);
  await expect(page.getByTestId('trip-header')).toBeVisible();

  // 숙소
  await page.getByRole('tab', { name: '숙소' }).click();
  await page.waitForTimeout(600);
  await mark('stays', 0, page.getByRole('tab', { name: '숙소' }));
  await mark('stays', 1, page.locator('[data-testid^=stay-card], [data-testid=stay-list] li, [data-testid=stay-list]').first());
  await shot(page, 'stays');

  // AI 챗봇
  await page.goto('/trips');
  await page.getByTestId('open-chat').click();
  await page.getByTestId('chat-input').fill('강릉으로 일정 짜줘');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('confirm-card')).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await mark('chat', 0, page.getByTestId('confirm-card'));
  await mark('chat', 1, page.getByTestId('confirm-apply'));
  await mark('chat', 2, page.getByTestId('chat-input'));
  await shot(page, 'chat');

  // 가계부(정산할 사람을 더하고 함께 낸 지출을 남긴다)
  await page.goto(`/trips/${id}/expenses`);
  await page.getByText(/정산할 사람 ·/).click();
  await page.getByLabel('정산할 사람 이름').fill('민지');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await page.goto(`/trips/${id}/expenses?add=none`);
  await page.locator('#expense-title').fill('초당순두부 점심');
  await page.locator('#expense-amount').fill('24000');
  const shares = page.locator('[id^=expense-share-]');
  for (let i = 0; i < (await shares.count()); i++) await shares.nth(i).check();
  await page.getByRole('button', { name: '지출 저장' }).click();
  await page.goto(`/trips/${id}/expenses`);
  await expect(page.getByText('초당순두부 점심')).toBeVisible();
  await mark('expenses', 0, page.getByText('실제 지출').locator('xpath=ancestor::*[contains(@class,"rounded-panel")][1]'));
  await mark('expenses', 1, page.getByText('초당순두부 점심').locator('xpath=ancestor::*[contains(@class,"rounded-panel")][1]'));
  await mark('expenses', 2, page.getByTestId('scan-expense'));
  await mark('expenses', 3, page.getByTestId('add-expense'));
  await mark('expenses', 4, page.getByText(/정산할 사람 ·/));
  await shot(page, 'expenses');

  // 영수증 사진으로 입력
  const receipt = await receiptImage(page);
  await page.getByTestId('scan-expense').click();
  await page.getByTestId('receipt-file').setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: receipt });
  await expect(page.getByTestId('receipt-canvas')).toBeVisible();
  // 사진을 올린 단계에서 찍는다. 읽기를 마치면 사진 대신 읽은 목록만 남는다.
  await page.getByTestId('receipt-marker').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -70));
  await page.waitForTimeout(400);
  await mark('receipt', 0, page.getByTestId('receipt-marker'));
  await mark('receipt', 1, page.getByTestId('receipt-canvas'));
  await mark('receipt', 2, page.getByTestId('receipt-scan-run'));
  await shot(page, 'receipt');

  // 정산 현황
  await page.goto(`/trips/${id}/expenses`);
  await page.getByRole('tab', { name: '정산 현황' }).click();
  await expect(page.getByTestId('panel-settlement')).toBeVisible();
  await mark('settle', 0, page.getByRole('tab', { name: '정산 현황' }));
  await mark('settle', 1, page.getByTestId('panel-settlement'));
  await mark('settle', 2, page.getByTestId('copy-settlement'));
  await shot(page, 'settle');

  // 일정 이미지 저장
  await page.goto(`/trips/${id}/export`);
  await expect(page.getByTestId('download-itinerary')).toBeVisible();
  await page.waitForTimeout(800);
  await mark('export', 0, page.getByTestId('toggle-all-sections'));
  await mark('export', 1, page.getByTestId('download-itinerary'));
  await mark('export', 2, page.locator('#export-date'));
  await mark('export', 3, page.getByText('예상 비용 포함'));
  await shot(page, 'export');

  // 친구 초대
  await page.goto(`/trips/${id}/invite`);
  await page.getByTestId('invite-create').click();
  await expect(page.getByTestId('invite-link')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await mark('invite', 0, page.getByTestId('invite-ticket'));
  await mark('invite', 1, page.getByTestId('invite-copy'));
  await mark('invite', 2, page.getByTestId('invite-link'));
  await mark('invite', 3, page.getByTestId('invite-renew'));
  await shot(page, 'invite');

  // 다녀온 곳 지도(지난 날짜의 여행. 주소가 있는 장소가 있어야 지역이 쌓인다)
  const past = [
    { title: '강릉 여름 여행', region: '강릉시', name: '경포해변', address: '강원 강릉시 창해로 514' },
    { title: '전주 한옥 여행', region: '전주시', name: '전주한옥마을', address: '전북특별자치도 전주시 완산구 기린대로 99' },
    { title: '여수 밤바다', region: '여수시', name: '돌산공원', address: '전남 여수시 돌산읍 돌산로 3600' },
    { title: '부산 바다 여행', region: '해운대구', name: '해운대해수욕장', address: '부산 해운대구 우동 1411' },
  ];
  for (const [i, trip] of past.entries()) {
    const date = `2026-0${5 + i}-01`;
    const tripId = await createTrip(page, { title: trip.title, start: date, end: date, regions: [trip.region] });
    await addStop(page, tripId, { name: trip.name, address: trip.address, date });
  }
  await page.goto('/stats');
  await page.waitForTimeout(2500);
  await mark('map', 0, page.locator('canvas, [data-testid=block-map], app-voxel-map').first());
  await mark('map', 1, page.getByTestId('stats-summary'));
  await shot(page, 'map');

  // 밝게 남길 자리를 코드로 남긴다.
  const body =
    `// 자동 생성: e2e/guide.capture.ts. 손으로 고치지 말고 캡처를 다시 돌린다.\n` +
    `/** 사용법 캡처의 크기(px)와 밝게 남길 자리(화면 비율 %)와 모서리 둥글기(px). spot은 GUIDE_SLIDES의 spots 순서다. */\n` +
    `export interface GuideMark { readonly spot: number; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly r: number }\n\n` +
    `export const GUIDE_SHOT = { width: ${W}, height: ${H} } as const;\n\n` +
    `export const GUIDE_MARKS: Readonly<Record<string, readonly GuideMark[]>> = ${JSON.stringify(marks, null, 2)};\n`;
  await writeFile('src/app/features/guide/model/guide-marks.ts', body, 'utf8');
});
