import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalScroll, resetApp } from './helpers';

/**
 * 관리자 메뉴와 /admin 진입을 검증한다. 관리자 여부는 서버 함수
 * is_admin의 응답을 가로채 정한다. 실제 서버 규칙은 SQL 검증이 맡는다.
 */

async function answerIsAdmin(page: Page, admin: boolean): Promise<void> {
  await page.route('**/rest/v1/rpc/is_admin', (route) => route.fulfill({ json: admin }));
}

test.beforeEach(async ({ page }) => {
  await resetApp(page);
});

test('관리자는 내 정보에서 관리자 화면으로 들어간다', async ({ page }) => {
  await answerIsAdmin(page, true);
  await page.goto('/account');
  await page.getByTestId('go-admin').click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByTestId('admin-home')).toBeVisible();
  await expect(page.getByTestId('admin-notices')).toContainText('준비 중');
  await expect(page.getByTestId('admin-inquiries')).toContainText('준비 중');
  await expectNoHorizontalScroll(page);
});

test('일반 사용자에게는 관리자 메뉴가 없다', async ({ page }) => {
  await answerIsAdmin(page, false);
  await page.goto('/account');
  await expect(page.getByTestId('go-notices')).toBeVisible();
  await expect(page.getByTestId('go-admin')).toHaveCount(0);
});

test('일반 사용자가 주소를 직접 입력하면 내 정보로 돌아간다', async ({ page }) => {
  await answerIsAdmin(page, false);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByTestId('admin-home')).toHaveCount(0);
});

test('관리자 여부를 확인하지 못하면 막는다', async ({ page }) => {
  await page.route('**/rest/v1/rpc/is_admin', (route) =>
    route.fulfill({ status: 500, json: { message: 'boom' } }),
  );
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByTestId('go-admin')).toHaveCount(0);
});
