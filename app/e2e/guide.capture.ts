import { expect, test, type Locator, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { addStop, createTrip, resetApp } from './helpers';

/**
 * 구름이가 안내하는 사용법의 캡처와 설명 표시 위치를 만든다(2026-10-01).
 * 테스트 앱의 고정 데이터만 쓰므로 실제 사용자 정보가 들어가지 않는다. 화면이 바뀌면 다시 돌린다:
 *   npx playwright test --config=playwright.capture.config.ts
 * 결과: public/guide/*.jpg, src/app/features/guide/model/guide-marks.ts(설명 번호의 자리·글)
 */
const OUT = 'public/guide';
const W = 390;
const H = 844;

interface Mark { n: number; x: number; y: number; w: number; h: number; label: string }
const marks: Record<string, Mark[]> = {};

/** 사용자에게 보일 안내이므로 테스트 데이터의 표시를 화면 글자에서만 지운다. 앱 코드는 바꾸지 않는다. */
async function tidy(page: Page): Promise<void> {
  await page.evaluate(() => {
    const swaps: [RegExp, string][] = [
      [/테스트용\s*추천 이유:\s*/g, ''],
      [/테스트용\s*/g, ''],
      [/\s*예시(?=[)\s]|$)/g, ''],
      [/강릉 테스트 호텔/g, '경포 바다 호텔'],
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
 * 설명할 자리를 잰다. 화면 비율(%)로 남겨 어떤 크기로 보여도 맞게 한다.
 * 찾지 못하면 그 번호를 건너뛴다(캡처는 계속한다).
 */
async function mark(slide: string, label: string, target: Locator): Promise<void> {
  const box = await target.first().boundingBox({ timeout: 3000 }).catch(() => null);
  if (!box) return;
  const list = (marks[slide] ??= []);
  const pad = 4;
  const x = Math.max(0, box.x - pad);
  const y = Math.max(0, box.y - pad);
  const w = Math.min(W - x, box.width + pad * 2);
  const h = Math.min(H - y, box.height + pad * 2);
  if (w <= 0 || h <= 0 || y >= H) return;
  const pct = (v: number, total: number) => Math.round((v / total) * 1000) / 10;
  list.push({ n: list.length + 1, x: pct(x, W), y: pct(y, H), w: pct(w, W), h: pct(h, H), label });
}

async function shot(page: Page, slide: string): Promise<void> {
  await tidy(page);
  await page.screenshot({ path: `${OUT}/${slide}.jpg`, type: 'jpeg', quality: 76, animations: 'disabled' });
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

test.use({ viewport: { width: W, height: H }, hasTouch: true, deviceScaleFactor: 1 });

test('사용법 캡처', async ({ page, context }) => {
  test.setTimeout(300_000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await resetApp(page);

  // 01. 여행 목록
  await createTrip(page, { title: '속초 가을 여행', start: '2026-11-07', end: '2026-11-08', regions: ['속초시'] });
  await createTrip(page, { title: '부산 겨울 여행', start: '2026-12-19', end: '2026-12-20', regions: ['부산'] });
  await page.goto('/trips');
  await expect(page.getByText('속초 가을 여행')).toBeVisible();
  await mark('01-trips', '조건만 고르면 AI가 코스를 짜 줘요', page.getByTestId('new-trip-ai'));
  await mark('01-trips', '직접 여행을 만들 수도 있어요', page.getByTestId('new-trip'));
  await mark('01-trips', '여행 카드를 누르면 상세로 가요', page.getByTestId('trip-list').locator('a, [role=link], article').first());
  await mark('01-trips', '구름이 AI 챗봇', page.getByTestId('open-chat'));
  await shot(page, '01-trips');

  // 02. 일정 짜기 조건
  await page.goto('/trips/ai');
  await page.getByTestId('ai-region-input').fill('강릉');
  await page.getByTestId('ai-region-match-강릉시').click();
  await page.getByTestId('ai-region-input').fill('속초');
  await page.getByTestId('ai-region-match-속초시').click();
  await page.getByTestId('ai-start').fill('2026-10-10');
  await page.getByTestId('ai-end').fill('2026-10-11');
  await mark('02-plan-input', '가고 싶은 지역을 찾아 순서대로 골라요', page.getByTestId('ai-region-input'));
  await mark('02-plan-input', '고른 지역', page.getByTestId('ai-region-list'));
  await mark('02-plan-input', '여행 날짜(미정이어도 돼요)', page.getByTestId('ai-period-input').or(page.getByTestId('ai-start')));
  await mark('02-plan-input', '동행·이동수단·취향은 다음 단계에서', page.getByTestId('ai-next-1'));
  // 입력칸 선택 표시를 빼고 찍는다.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await shot(page, '02-plan-input');

  // 03. 일정 짜기 결과
  await page.getByTestId('ai-next-1').click();
  await page.getByTestId('ai-next-2').click();
  await page.getByTestId('ai-next-3').click();
  await page.getByTestId('ai-generate').click();
  await expect(page.getByTestId('ai-result')).toBeVisible();
  await page.getByTestId('ai-result').scrollIntoViewIfNeeded();
  await mark('03-plan-result', '빼고 싶은 곳은 체크를 풀어요', page.getByTestId('ai-result').getByRole('checkbox').nth(1));
  await mark('03-plan-result', '요금·체류는 AI 추정이에요', page.getByText('AI 추정').first());
  await mark('03-plan-result', '일차를 바꿀 수 있어요', page.getByTestId('ai-result').getByRole('combobox').first());
  await mark('03-plan-result', '고른 곳만 여행에 담아요', page.getByTestId('ai-commit'));
  await shot(page, '03-plan-result');

  // 04. 담은 여행의 상세
  await page.getByTestId('ai-commit').click();
  await expect(page.getByTestId('trip-header')).toBeVisible();
  const id = new URL(page.url()).pathname.split('/')[2]!;
  await page.waitForTimeout(1200);
  await mark('04-trip', '날짜별로 일정을 봐요', page.getByRole('tab').filter({ hasText: '1일차' }));
  await mark('04-trip', '지도에 방문 순서가 보여요', page.locator('[data-testid=panel-days] .map, app-trip-map, [data-testid=trip-map]').first());
  await mark('04-trip', '가까운 순으로 순서를 정리해요', page.getByTestId('sort-nearest'));
  await mark('04-trip', '장소·식사·카페를 직접 더해요', page.getByTestId('add-open'));
  await mark('04-trip', '가계부·정산', page.getByTestId('go-expenses'));
  await shot(page, '04-trip');

  // 05. 숙소
  await page.getByRole('tab', { name: '숙소' }).click();
  await page.waitForTimeout(600);
  await mark('05-stays', '숙소 탭', page.getByRole('tab', { name: '숙소' }));
  await mark('05-stays', '체크인·체크아웃과 몇 박인지', page.locator('[data-testid^=stay-card], [data-testid=stay-list] li, [data-testid=stay-list]').first());
  await shot(page, '05-stays');

  // 06. AI 챗봇
  await page.goto('/trips');
  await page.getByTestId('open-chat').click();
  await page.getByTestId('chat-input').fill('강릉으로 일정 짜줘');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('confirm-card')).toBeVisible();
  await mark('06-chat', '물어본 말', page.getByTestId('chat-user-message').first());
  await mark('06-chat', '추천과 추천 이유를 확인해요', page.getByTestId('confirm-card'));
  await mark('06-chat', '마음에 들면 적용, 아니면 그대로 두기', page.getByTestId('confirm-apply'));
  await mark('06-chat', '이어서 물어볼 말', page.getByTestId('chat-chips'));
  await mark('06-chat', '자유롭게 물어봐요', page.getByTestId('chat-input'));
  await shot(page, '06-chat');

  // 07. 가계부(정산할 사람을 더하고 함께 낸 지출을 남긴다)
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
  await mark('07-expenses', '일정 예상 비용과 실제 지출', page.getByText('실제 지출').locator('xpath=ancestor::*[contains(@class,"rounded-panel")][1]'));
  await mark('07-expenses', '함께 정산할 사람', page.getByText(/정산할 사람 ·/));
  await mark('07-expenses', '기록한 지출', page.getByText('초당순두부 점심'));
  await mark('07-expenses', '영수증 사진으로 입력', page.getByTestId('scan-expense'));
  await mark('07-expenses', '직접 기록', page.getByTestId('add-expense'));
  await shot(page, '07-expenses');

  // 08. 영수증 사진으로 입력
  const receipt = await receiptImage(page);
  await page.getByTestId('scan-expense').click();
  await page.getByTestId('receipt-file').setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: receipt });
  await expect(page.getByTestId('receipt-canvas')).toBeVisible();
  // 사진을 올린 단계에서 찍는다. 읽기를 마치면 사진 대신 읽은 목록만 남는다.
  await page.getByTestId('receipt-scan').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -64));
  await page.waitForTimeout(400);
  await mark('08-receipt', '영수증·결제 내역 사진', page.getByTestId('receipt-canvas'));
  await mark('08-receipt', '읽을 줄만 형광펜으로 칠할 수도 있어요', page.getByTestId('receipt-marker'));
  await mark('08-receipt', '읽기를 누르면 품목·금액을 채워 줘요', page.getByTestId('receipt-scan-run'));
  await shot(page, '08-receipt');

  // 09. 정산 현황
  await page.goto(`/trips/${id}/expenses`);
  await page.getByRole('tab', { name: '정산 현황' }).click();
  await expect(page.getByTestId('panel-settlement')).toBeVisible();
  await mark('09-settle', '정산 현황 탭', page.getByRole('tab', { name: '정산 현황' }));
  await mark('09-settle', '누가 누구에게 얼마 보내면 되는지', page.getByTestId('panel-settlement'));
  await mark('09-settle', '정산 내용을 복사해 단톡방에', page.getByTestId('copy-settlement'));
  await shot(page, '09-settle');

  // 10. 일정 이미지 저장
  await page.goto(`/trips/${id}/export`);
  await expect(page.getByTestId('download-itinerary')).toBeVisible();
  await page.waitForTimeout(800);
  await mark('10-export', '날짜를 접고 펼쳐 담을 내용을 정해요', page.getByTestId('toggle-all-sections'));
  await mark('10-export', '이미지로 저장', page.getByTestId('download-itinerary'));
  await shot(page, '10-export');

  // 11. 친구 초대
  await page.goto(`/trips/${id}/invite`);
  await page.getByTestId('invite-create').click();
  await expect(page.getByTestId('invite-link')).toBeVisible();
  await mark('11-invite', '초대장', page.getByTestId('invite-ticket'));
  await mark('11-invite', '링크를 복사해 보내요', page.getByTestId('invite-copy'));
  await shot(page, '11-invite');

  // 12. 다녀온 곳 지도(지난 날짜의 여행. 주소가 있는 장소가 있어야 지역이 쌓인다)
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
  await mark('12-map', '다녀온 지역이 지도에 쌓여요', page.locator('canvas, [data-testid=block-map], app-voxel-map').first());
  await mark('12-map', '자세한 통계', page.getByRole('link', { name: /통계|자세히/ }));
  await shot(page, '12-map');

  // 설명 표시 자리를 코드로 남긴다.
  const body = `// 자동 생성: e2e/guide.capture.ts. 손으로 고치지 말고 캡처를 다시 돌린다.\n` +
    `/** 사용법 캡처 위 설명 번호의 자리(화면 비율 %)와 글. */\n` +
    `export interface GuideMark { readonly n: number; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly label: string }\n\n` +
    `export const GUIDE_MARKS: Readonly<Record<string, readonly GuideMark[]>> = ${JSON.stringify(marks, null, 2)};\n`;
  await writeFile('src/app/features/guide/model/guide-marks.ts', body, 'utf8');
});
