import { expect, test } from '@playwright/test';
import { resetApp } from './helpers';

/**
 * 초대 링크를 앱에 붙여 넣어 열기(2026-10-01). 아이폰은 홈 화면 앱으로 링크를 넘기지 않아 초대 링크가 Safari로 열린다.
 */
test.describe('앱에서 초대 링크 붙여넣기', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test('여행이 없는 첫 화면에서 초대 링크를 붙여 넣어 합류 화면을 연다', async ({ page }) => {
    await page.getByTestId('empty-join-paste').click();
    await expect(page).toHaveURL(/\/join$/);
    await page.getByTestId('join-paste-input').fill('같이 가요! https://triplo.pages.dev/join/abcd-efgh');
    await page.getByTestId('join-paste-open').click();
    await expect(page).toHaveURL(/\/join\/ABCD-EFGH$/);
  });

  test('초대 링크가 아니면 이유를 보인다', async ({ page }) => {
    await page.goto('/join');
    await page.getByTestId('join-paste-input').fill('https://triplo.pages.dev/trips/123');
    await page.getByTestId('join-paste-open').click();
    await expect(page.getByTestId('join-paste-error')).toHaveText('초대 링크나 코드(예: ABCD-EFGH)를 붙여 넣어 주세요.');
    await expect(page).toHaveURL(/\/join$/);
  });
});

test.describe('아이폰 Safari로 열린 초대', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });

  test('홈 화면 앱에서 여는 방법과 링크 복사를 보인다', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/join/ABCD-EFGH');
    await expect(page.getByTestId('join-open-in-app')).toBeVisible();
    await expect(page.getByTestId('join-install')).toHaveAttribute('href', '/install?next=%2Fjoin%2FABCD-EFGH');
    await page.getByTestId('join-copy-link').click();
    await expect(page.getByTestId('success-toast')).toContainText('링크를 복사했어요');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('/join/ABCD-EFGH');
  });
});

test('아이폰이 아니면 앱 안내를 보이지 않는다', async ({ page }) => {
  await page.goto('/join/ABCD-EFGH');
  await expect(page.getByTestId('join-page')).toBeVisible();
  await expect(page.getByTestId('join-open-in-app')).toHaveCount(0);
});

test.describe('안드로이드 크롬에서 앱을 설치하지 않은 경우', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
  });

  test('초대 링크를 열면 설치 안내로 가고, 웹에서 계속하면 초대로 돌아와 다시 끌려가지 않는다', async ({ page }) => {
    await page.addInitScript(() => {
      (navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> }).getInstalledRelatedApps = async () => [];
    });
    await page.goto('/join/ABCD-EFGH');
    await expect(page).toHaveURL(/\/install\?next=%2Fjoin%2FABCD-EFGH$/);
    await page.getByTestId('install-continue-web').click();
    await expect(page).toHaveURL(/\/join\/ABCD-EFGH$/);
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/join\/ABCD-EFGH$/);
  });

  test('앱이 설치되어 있으면 설치 안내로 보내지 않는다', async ({ page }) => {
    await page.addInitScript(() => {
      (navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> }).getInstalledRelatedApps = async () => [{ platform: 'webapp' }];
    });
    await page.goto('/join/ABCD-EFGH');
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/join\/ABCD-EFGH$/);
  });
});
