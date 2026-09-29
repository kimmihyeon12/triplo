import { expect, test, type Page } from '@playwright/test';
import { createTrip, resetApp } from './helpers';

/**
 * 사진으로 지출 입력. 테스트 앱은 고정 응답 제공자를 쓴다. 전체를 읽으면
 * 생수·과자·맥주와 금액이 음수인 '할인'을 내고, 형광펜을 칠하면 맥주만 낸다.
 */

// 8x8 흰색 PNG. 브라우저가 실제로 디코드할 수 있는 사진이어야 캔버스까지 간다.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAD0lEQVR4nGP4jwMwDC0JALoev0Ewkwr8AAAAAElFTkSuQmCC',
  'base64',
);

async function openScan(page: Page): Promise<void> {
  const id = await createTrip(page, {
    title: '사진 입력',
    start: '2026-05-01',
    end: '2026-05-02',
    regions: ['강릉시'],
  });
  await page.goto(`/trips/${id}/expenses`);
  await page.getByTestId('scan-expense').click();
  await page.getByTestId('receipt-file').setInputFiles({
    name: 'receipt.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await expect(page.getByTestId('receipt-canvas')).toBeVisible();
}

test.describe('사진으로 지출 입력', () => {
  test.beforeEach(async ({ page }) => resetApp(page));

  test('읽은 후보를 고치고 체크한 항목만 지출로 저장한다', async ({ page }) => {
    await openScan(page);
    await page.getByTestId('receipt-scan-run').click();

    const drafts = page.getByTestId('receipt-drafts').getByRole('listitem');
    await expect(drafts).toHaveCount(3);
    await expect(page.getByTestId('receipt-dropped')).toContainText('1건');

    await page.getByTestId('receipt-check-1').uncheck();
    await page.getByTestId('receipt-amount-2').fill('5000');
    await expect(page.getByTestId('receipt-save')).toHaveText('2건 저장');
    await page.getByTestId('receipt-save').click();

    await expect(page.getByTestId('scan-status')).toContainText('2건을 기록했어요');
    const list = page.getByTestId('panel-expenses');
    await expect(list.getByText('생수')).toBeVisible();
    await expect(list.getByText('맥주')).toBeVisible();
    await expect(list.getByText('과자')).toHaveCount(0);
    await expect(list.getByText('5,000원')).toBeVisible();
  });

  test('형광펜을 칠하면 칠한 줄만 읽도록 요청한다', async ({ page }) => {
    await openScan(page);
    await page.getByTestId('receipt-marker').click();
    // 작은 사진이 화면 너비로 늘어나 세로가 화면보다 길 수 있다. 보이는 윗부분에 칠한다.
    await page.getByTestId('receipt-canvas').scrollIntoViewIfNeeded();
    const box = (await page.getByTestId('receipt-canvas').boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 10, box.y + 20, { steps: 5 });
    await page.mouse.up();

    await expect(page.getByTestId('receipt-scan-run')).toHaveText('칠한 줄 읽기');
    await page.getByTestId('receipt-scan-run').click();
    await expect(page.getByTestId('receipt-drafts').getByRole('listitem')).toHaveCount(1);
  });

  test('한 건으로 합치면 체크한 금액의 합으로 한 건을 저장한다', async ({ page }) => {
    await openScan(page);
    await page.getByTestId('receipt-scan-run').click();
    await page.getByTestId('receipt-merge').check();
    await page.getByLabel('합친 지출명').fill('편의점');
    await expect(page.getByTestId('receipt-save')).toHaveText('1건으로 저장');
    await page.getByTestId('receipt-save').click();

    const list = page.getByTestId('panel-expenses');
    await expect(list.getByText('편의점')).toBeVisible();
    await expect(list.getByText('9,500원').first()).toBeVisible();
    await expect(list.getByRole('article')).toHaveCount(1);
  });

  test('읽기에 실패하면 사진을 유지한 채 이유를 알린다', async ({ page }) => {
    await openScan(page);
    await page.evaluate(() => localStorage.setItem('tc.test.receiptFail', '1'));
    await page.getByTestId('receipt-scan-run').click();
    await expect(page.getByTestId('receipt-error')).toContainText('읽지 못했어요');
    await expect(page.getByTestId('receipt-canvas')).toBeVisible();
  });
});
