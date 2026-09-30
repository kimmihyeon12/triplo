import { expect, test } from '@playwright/test';
import { STORAGE_KEY, resetApp } from './helpers';

/**
 * 공지·문의를 불러오지 못할 때 화면이 멈추지 않고 이유를 보인다.
 * 테스트 앱의 기기 저장소가 이 스위치를 보면 읽기를 실패시킨다(서버 저장소의 네트워크 오류 대역).
 */
const SUPPORT_FAIL = `${STORAGE_KEY}.supportFail`;

test.beforeEach(async ({ page }) => {
  await resetApp(page);
  await page.evaluate((flag) => localStorage.setItem(flag, '1'), SUPPORT_FAIL);
});

test.afterEach(async ({ page }) => {
  await page.evaluate((flag) => localStorage.removeItem(flag), SUPPORT_FAIL);
});

test('공지를 불러오지 못하면 로딩을 멈추고 이유를 보인다', async ({ page }) => {
  await page.goto('/account/notices');
  await expect(page.getByTestId('notices-error')).toBeVisible();
  await expect(page.getByRole('status', { name: '공지사항 불러오는 중' })).toHaveCount(0);
});

test('문의를 불러오지 못하면 로딩을 멈추고 이유를 보인다', async ({ page }) => {
  await page.goto('/account/inquiries');
  await expect(page.getByTestId('inquiries-error')).toBeVisible();
});

test('개수를 세지 못해도 내 정보 화면은 열린다', async ({ page }) => {
  await page.goto('/account');
  await expect(page.getByTestId('go-notices')).toBeVisible();
});
