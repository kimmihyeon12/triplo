import { expect, test } from '@playwright/test';
import { createTrip, FAIL_FLAG, resetApp, chooseOption } from './helpers';

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
    // 저장 실패는 화면을 옮겨도 보이도록 앱 전체의 오류 토스트로도 알린다.
    await expect(page.getByTestId('error-toast')).toContainText('테스트용 저장 실패');
    // 무엇이 잘못됐는지는 토스트가 알리고, 화면에는 다시 저장 버튼만 남는다.
    await expect(page.getByTestId('retry-save')).toBeVisible();
    await expect(page.getByTestId('trip-title')).toHaveValue('실패 테스트');
    await expect(page).toHaveURL(/\/trips\/new$/);

    await page.evaluate((flag) => localStorage.removeItem(flag), FAIL_FLAG);
    await page.getByTestId('trip-save').click();
    await expect(page.getByTestId('trip-title')).toHaveText('실패 테스트');
    // 저장에 성공하면 표시가 사라진다. 실패·충돌만 보인다.
    await expect(page.getByTestId('save-status')).toHaveCount(0);
  });

  test('오류 토스트는 화면 위쪽에 뜨고 위로 밀어서 닫는다', async ({ page }) => {
    await page.goto('/trips/new');
    await page.getByTestId('trip-title').fill('밀어서 닫기');
    await page.getByTestId('trip-start').fill('2026-05-01');
    await page.getByTestId('trip-end').fill('2026-05-02');
    await page.evaluate((flag) => localStorage.setItem(flag, '1'), FAIL_FLAG);
    await page.getByTestId('trip-save').click();
    const toast = page.getByTestId('error-toast');
    await expect(toast).toBeVisible();
    const box = (await toast.boundingBox())!;
    // 모든 화면에서 상단 바 바로 아래 같은 자리에 뜬다.
    expect(box.y).toBeLessThan(120);
    await page.mouse.move(box.x + 30, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 30, box.y + box.height / 2 - 80, { steps: 5 });
    await page.mouse.up();
    await expect(toast).toHaveCount(0);
  });

  test('상세에서 순서 변경 저장이 실패하면 화면 상태는 유지되고 재시도로 기기에 반영된다', async ({
    page,
  }) => {
    const id = await createTrip(page, { start: '2026-05-01', end: '2026-05-01' });
    await page.goto(`/trips/${id}/stops/new`);
    await page.getByTestId('stop-name').fill('가');
    await chooseOption(page, 'stop-date', '2026-05-01');
    await page.getByTestId('stop-save').click();
    await page.goto(`/trips/${id}/stops/new`);
    await page.getByTestId('stop-name').fill('나');
    await chooseOption(page, 'stop-date', '2026-05-01');
    await page.getByTestId('stop-save').click();
    const items = page.getByTestId('day-items').locator('li.item strong');
    await expect(items).toHaveText(['가', '나']);

    await page.evaluate((flag) => localStorage.setItem(flag, '1'), FAIL_FLAG);
    await page.getByRole('button', { name: '나 위로' }).click();
    await expect(items).toHaveText(['나', '가']);
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'error');

    await page.evaluate((flag) => localStorage.removeItem(flag), FAIL_FLAG);
    // 목록 아래에서 편집하면 헤더의 다시 저장은 화면 밖이고 알림이 그 자리를 덮는다.
    // 그래서 알림 안의 다시 저장으로 바로 복구한다.
    const toast = page.getByTestId('error-toast');
    await toast.getByTestId('toast-action').click();
    await expect(toast).toHaveCount(0);
    // 저장에 성공하면 표시가 사라진다. 실패·충돌만 보인다.
    await expect(page.getByTestId('save-status')).toHaveCount(0);
    await page.reload();
    await expect(items).toHaveText(['나', '가']);
  });
});
