import { expect, test } from '@playwright/test';
import { createTrip, resetApp } from './helpers';

// 헤드리스 크롬은 터치로 꾸민 목록을 열지 않아 화면을 띄워 확인한다.
test.use({ headless: false });

/** 터치·휴대폰 보기에서 공통 선택 상자(base-select)의 목록 항목을 누르면 골라진다(2026-10-02 회귀). */
test('터치로 연 선택 목록에서 항목을 누르면 골라지고 닫힌다', async ({ page }, info) => {
  test.skip(!info.project.use.hasTouch, '터치 기기에서만 생기는 문제다');
  await resetApp(page);
  const id = await createTrip(page, { title: '선택', start: '2026-05-01', end: '2026-05-03', regions: ['강릉시'] });
  await page.goto(`/trips/${id}/stops/new`);
  const select = page.getByTestId('stop-date');
  await select.scrollIntoViewIfNeeded();
  const isOpen = () => select.evaluate((el) => { try { return el.matches(':open'); } catch { return null; } });
  test.skip((await select.evaluate((el) => getComputedStyle(el).appearance)) !== 'base-select', '꾸민 목록을 지원하는 브라우저만');
  const box = (await select.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(isOpen).toBe(true);
  const option = (await select.locator('option').nth(2).boundingBox())!;
  await page.touchscreen.tap(option.x + option.width / 2, option.y + option.height / 2);
  await expect(select).toHaveValue('2026-05-02');
  await expect.poll(isOpen).toBe(false);
});
