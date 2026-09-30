import { expect, test } from '@playwright/test';
import { addStop, chooseRowMenu, createTrip, openTripMenu, resetApp } from './helpers';

/**
 * 일을 마친 폼은 뒤로 가기 기록에 남지 않아야 한다.
 * 목록 → 상세 → 폼 → 저장 뒤 뒤로 가면 폼이나 같은 상세가 아니라 목록으로 간다.
 * 첫 화면은 이동으로 세지 않으므로 목록에서 눌러 들어간다.
 */
test.describe('폼 저장 뒤 뒤로 가기', () => {
  let id = '';

  test.beforeEach(async ({ page }) => {
    await resetApp(page);
    id = await createTrip(page, { title: '기록 여행', start: '2026-05-01', end: '2026-05-01' });
    await addStop(page, id, { name: '가', date: '2026-05-01' });
    await page.goto('/trips');
    await page.getByTestId('trip-card-' + id).click();
    await expect(page).toHaveURL(new RegExp(`/trips/${id}$`));
  });

  test('여행 정보를 고친 뒤 뒤로 가면 목록으로 간다', async ({ page }) => {
    await openTripMenu(page);
    await page.getByTestId('trip-edit').click();
    await page.locator('input[data-testid="trip-title"]').fill('고친 여행');
    await page.getByTestId('trip-save').click();
    await expect(page.getByTestId('trip-title')).toHaveText('고친 여행');
    await page.goBack();
    await expect(page).toHaveURL(/\/trips$/);
  });

  test('목록에서 여행 정보를 고치면 상세가 보이고 뒤로 가면 목록으로 간다', async ({ page }) => {
    await page.goBack();
    await expect(page).toHaveURL(/\/trips$/);
    await chooseRowMenu(page, '기록 여행', '여행 정보 수정');
    await page.locator('input[data-testid="trip-title"]').fill('목록에서 고친 여행');
    await page.getByTestId('trip-save').click();
    await expect(page).toHaveURL(new RegExp(`/trips/${id}$`));
    await expect(page.getByTestId('trip-title')).toHaveText('목록에서 고친 여행');
    await page.goBack();
    await expect(page).toHaveURL(/\/trips$/);
  });

  test('장소를 고친 뒤 뒤로 가면 목록으로 간다', async ({ page }) => {
    await chooseRowMenu(page, '가', '편집');
    await page.getByTestId('stop-name').fill('나');
    await page.getByTestId('stop-save').click();
    await expect(page.getByTestId('day-items')).toContainText('나');
    await page.goBack();
    await expect(page).toHaveURL(/\/trips$/);
  });
});
