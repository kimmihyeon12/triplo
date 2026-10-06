import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resetApp } from './helpers';

/**
 * Play 스토어 이미지에 넣을 앱 화면을 찍는다(2026-10-06).
 *   npx playwright test --config=playwright.store.config.ts
 * store 빌드(4200)는 테스트 앱처럼 모의 인증·기기 저장·고정 AI 응답을 쓰고, 지도·장소 검색만 실제 카카오다.
 * 결과: ../store/screens/<이름>.png(3배 해상도)와 focus.json(화면별로 확대해 보일 자리, CSS px).
 * 합성은 ../store/render.mjs가 한다.
 */
const OUT = '../store/screens';
const W = 390;
const H = 844;

interface Box { x: number; y: number; w: number; h: number; r: number }
const focus: Record<string, Box> = {};

/** 테스트 데이터 표시를 화면 글자에서만 지운다. 앱 코드는 바꾸지 않는다(guide.capture.ts와 같은 규칙). */
async function tidy(page: Page): Promise<void> {
  await page.evaluate(() => {
    const swaps: [RegExp, string][] = [
      [/테스트용\s*추천 이유:\s*/g, ''],
      [/테스트용\s*/g, ''],
      [/\s*예시(?=[)\s]|$)/g, ''],
      [/ (\S+) \(\1\)/g, ' $1'],
      [/강릉 테스트 호텔/g, '경포 바다 호텔'],
      [/테스트 회센터/g, '경포 회센터'],
      [/테스트 픽스처/g, '카카오'],
      [/http:\/\/localhost:4200/g, 'https://triplo.pages.dev'],
      [/TEST-CODE/g, 'K7QM-2XRB'],
      [/이 기기에 저장 · 친구와 공유되지 않습니다/g, ''],
    ];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      let text = node.textContent ?? '';
      for (const [from, to] of swaps) text = text.replace(from, to);
      if (text !== node.textContent) node.textContent = text;
    }
    document.querySelectorAll<HTMLInputElement>('input').forEach((el) => {
      el.value = el.value.replace(/http:\/\/localhost:4200/g, 'https://triplo.pages.dev').replace(/TEST-CODE/g, 'K7QM-2XRB');
    });
  });
}

/** 확대해 보일 자리를 잰다. 화면 안으로 잘라 남긴다. */
async function mark(name: string, target: Locator): Promise<void> {
  const box = await target.first().boundingBox({ timeout: 3000 }).catch(() => null);
  if (!box) throw new Error(`${name}: 확대할 자리를 찾지 못했다`);
  const r = await target.first().evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0);
  const x = Math.max(0, box.x);
  const y = Math.max(0, box.y);
  focus[name] = { x, y, w: Math.min(W, box.x + box.width) - x, h: Math.min(H, box.y + box.height) - y, r };
}

async function shot(page: Page, name: string, target: Locator | null, hideChat = true): Promise<void> {
  await tidy(page);
  if (hideChat) {
    await page.evaluate(() => document.querySelectorAll<HTMLElement>('[data-testid=open-chat]').forEach((el) => (el.style.visibility = 'hidden')));
  }
  await page.waitForTimeout(300);
  if (target) await mark(name, target);
  await page.screenshot({ path: `${OUT}/${name}.png`, type: 'png', animations: 'disabled' });
}

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

test.use({ viewport: { width: W, height: H }, hasTouch: true, deviceScaleFactor: 3 });

test('스토어 이미지용 화면', async ({ page, context }) => {
  test.setTimeout(300_000);
  await mkdir(OUT, { recursive: true });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await resetApp(page);

  // 일정 짜기 결과. 위치 확인 안내는 넘기고 예상 비용과 추천 코스부터 보인다.
  await page.goto('/trips/ai');
  await page.getByTestId('ai-region-input').fill('강릉');
  await page.getByTestId('ai-region-match-강릉시').click();
  await page.getByTestId('ai-region-input').fill('속초');
  await page.getByTestId('ai-region-match-속초시').click();
  await page.getByTestId('ai-start').fill('2026-10-10');
  await page.getByTestId('ai-end').fill('2026-10-11');
  await page.getByTestId('ai-next-1').click();
  await page.getByTestId('ai-next-2').click();
  await page.getByTestId('ai-next-3').click();
  await page.getByTestId('ai-generate').click();
  const result = page.getByTestId('ai-result');
  await expect(result).toBeVisible({ timeout: 30_000 });
  await page.getByText('예상 총액').first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -96));
    await shot(page, 'plan-result', page.getByText('예상 총액').first().locator('xpath=ancestor::*[contains(@class,"rounded")][1]'));

  // 여행 상세: 실제 지도 위 방문 순서
  await page.getByTestId('ai-commit').click();
  await expect(page.getByTestId('trip-header')).toBeVisible();
  const id = new URL(page.url()).pathname.split('/')[2]!;
  await page.waitForTimeout(3500);
  await shot(page, 'trip', page.getByTestId('trip-map'));

  // 지도에서 담기: 실제 주변 장소
  await page.goto(`/trips/${id}/map`);
  await expect(page.getByTestId('map-explore')).toBeVisible();
  await page.waitForTimeout(2500);
  await page.getByTestId('map-category-meal').click();
  await page.waitForTimeout(3000);
  // 실제 카카오 지도의 핀은 테스트 번호가 없어 분류 클래스로 찾는다. 겹친 핀이 있어 요소를 직접 누른다.
  const pin = page.locator('button.tc-pin--meal').nth(2);
  await pin.evaluate((el) => (el as HTMLButtonElement).click());
  await expect(page.getByTestId('map-explore-sheet')).toBeVisible();
  await page.waitForTimeout(1500);
  await shot(page, 'map-explore', page.getByTestId('map-explore-sheet'));

  // AI 챗봇: 한 번 묻고 나서 일정을 부탁한다.
  await page.goto('/trips');
  await page.getByTestId('open-chat').click();
  await page.getByTestId('chat-input').fill('가을에 바다 보러 어디 가면 좋을까?');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-assistant-message')).toHaveCount(1);
  await page.getByTestId('chat-input').fill('강릉으로 일정 짜줘');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('confirm-card')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('confirm-card').evaluate((el) => el.scrollIntoView({ block: 'end' }));
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await shot(page, 'chat', page.getByTestId('confirm-card'), false);

  // 가계부: 정산할 사람과 함께 낸 지출
  await page.goto(`/trips/${id}/expenses`);
  await page.getByText(/정산할 사람 ·/).click();
  await page.getByLabel('정산할 사람 이름').fill('민지');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  for (const [title, amount] of [['초당순두부 점심', '24000'], ['경포 회센터 저녁', '68000'], ['안목 카페', '13500']] as const) {
    await page.goto(`/trips/${id}/expenses?add=none`);
    await page.locator('#expense-title').fill(title);
    await page.locator('#expense-amount').fill(amount);
    const shares = page.locator('[id^=expense-share-]');
    for (let i = 0; i < (await shares.count()); i++) await shares.nth(i).check();
    await page.getByRole('button', { name: '지출 저장' }).click();
  }
  await page.goto(`/trips/${id}/expenses`);
  await expect(page.getByText('초당순두부 점심')).toBeVisible();
  await shot(page, 'expenses', page.getByText('실제 지출').locator('xpath=ancestor::*[contains(@class,"rounded-panel")][1]'));

  // 영수증 사진으로 입력
  const receipt = await receiptImage(page);
  await page.getByTestId('scan-expense').click();
  await page.getByTestId('receipt-file').setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: receipt });
  await expect(page.getByTestId('receipt-canvas')).toBeVisible();
  await page.getByTestId('receipt-marker').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -70));
  await page.waitForTimeout(400);
  await shot(page, 'receipt', page.getByTestId('receipt-canvas'));

  // 친구 초대
  await page.goto(`/trips/${id}/invite`);
  await page.getByTestId('invite-create').click();
  await expect(page.getByTestId('invite-link')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'invite', page.getByTestId('invite-ticket'));

  await writeFile(`${OUT}/focus.json`, JSON.stringify({ viewport: { width: W, height: H }, focus }, null, 2));
});
