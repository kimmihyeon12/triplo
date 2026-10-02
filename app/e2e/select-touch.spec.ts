import { expect, test } from '@playwright/test';
import { createTrip, resetApp } from './helpers';

/** 터치·휴대폰 보기에서 공통 선택 상자(app-select)의 목록 항목을 누르면 골라진다(2026-10-02 회귀). */
test('터치로 연 선택 목록에서 항목을 누르면 골라지고 닫힌다', async ({ page }, info) => {
  test.skip(!info.project.use.hasTouch, '터치 기기에서만 생기는 문제다');
  await resetApp(page);
  const id = await createTrip(page, { title: '선택', start: '2026-05-01', end: '2026-05-03', regions: ['강릉시'] });
  await page.goto(`/trips/${id}/stops/new`);
  const select = page.getByTestId('stop-date');
  const isOpen = async () => (await select.getAttribute('aria-expanded')) === 'true';
  // locator.tap은 화면에 보이게 옮기고 그 자리에 다른 것이 덮였는지까지 확인한 뒤 누른다.
  await select.tap();
  await expect.poll(isOpen).toBe(true);
  await page.getByTestId('stop-date-option-2026-05-02').tap();
  await expect(select).toHaveAttribute('data-value', '2026-05-02');
  await expect.poll(isOpen).toBe(false);
});
