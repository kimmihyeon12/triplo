import { expect, test } from '@playwright/test';
import { createTrip, FAIL_FLAG, resetApp } from './helpers';

test.describe('저장 실패 · 입력 보존 · 재시도', () => {
  test.beforeEach(async ({ page }) => resetApp(page));

  test('저장 실패 시 폼 입력이 남고, 복구 후 다시 저장하면 성공한다', async ({ page }) => {
    await page.goto('/trips/new');
    await page.getByTestId('trip-title').fill('실패 테스트');
    await page.getByTestId('trip-start').fill('2026-05-01');
    await page.getByTestId('trip-end').fill('2026-05-02');
    await page.evaluate((flag) => localStorage.setItem(flag, '1'), FAIL_FLAG);
    await page.getByTestId('trip-save').click();
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'error');
    await expect(page.getByText('저장에 실패했습니다.')).toBeVisible();
    await expect(page.getByTestId('trip-title')).toHaveValue('실패 테스트');
    await expect(page).toHaveURL(/\/trips\/new$/);

    await page.evaluate((flag) => localStorage.removeItem(flag), FAIL_FLAG);
    await page.getByTestId('trip-save').click();
    await expect(page.getByTestId('trip-title')).toHaveText('실패 테스트');
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved');
  });

  test('상세에서 순서 변경 저장이 실패하면 화면 상태는 유지되고 재시도로 기기에 반영된다', async ({ page }) => {
    const id = await createTrip(page, { start: '2026-05-01', end: '2026-05-01' });
    await page.goto(`/trips/${id}/stops/new`);
    await page.getByTestId('stop-name').fill('가');
    await page.getByTestId('stop-date').selectOption('2026-05-01');
    await page.getByTestId('stop-save').click();
    await page.goto(`/trips/${id}/stops/new`);
    await page.getByTestId('stop-name').fill('나');
    await page.getByTestId('stop-date').selectOption('2026-05-01');
    await page.getByTestId('stop-save').click();
    const items = page.getByTestId('day-items').locator('li.item strong');
    await expect(items).toHaveText(['가', '나']);

    await page.evaluate((flag) => localStorage.setItem(flag, '1'), FAIL_FLAG);
    await page.getByRole('button', { name: '나 위로' }).click();
    await expect(items).toHaveText(['나', '가']);
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'error');

    await page.evaluate((flag) => localStorage.removeItem(flag), FAIL_FLAG);
    await page.getByTestId('retry-save').click();
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved');
    await page.reload();
    await expect(items).toHaveText(['나', '가']);
  });
});
