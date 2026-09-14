import { expect, test } from '@playwright/test';

const authUrl = 'https://auth.test.supabase.co';
const newUser = {
  id: 'new-user',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'new@example.com',
  app_metadata: { provider: 'google' },
  user_metadata: { full_name: 'Google Name' },
  created_at: '2026-09-14T00:00:00Z',
};
test.beforeEach(async ({ page }) => {
  await page.route('**/supabase-config.test.json', (route) =>
    route.fulfill({ json: { url: authUrl, publishableKey: 'sb_publishable_test-only' } }),
  );
  await page.addInitScript((user) => {
    if (sessionStorage.getItem('onboarding-seeded')) return;
    sessionStorage.setItem('onboarding-seeded', '1');
    const exp = Math.floor(Date.now() / 1000) + 3600;
    localStorage.setItem(
      'tc.test.auth.v1',
      JSON.stringify({
        user,
        access_token: `${btoa('{}')}.${btoa(JSON.stringify({ exp }))}.sig`,
        refresh_token: 'test-refresh',
        expires_at: exp,
        token_type: 'bearer',
      }),
    );
  }, newUser);
});

test('처음 인증한 회원은 닉네임만 저장한 후 여행 목록으로 이동', async ({ page }) => {
  let saved = '';
  await page.route(`${authUrl}/auth/v1/user**`, async (route) => {
    saved = route.request().postDataJSON().data.travel_nickname;
    await route.fulfill({
      json: { ...newUser, user_metadata: { ...newUser.user_metadata, travel_nickname: saved } },
    });
  });
  await page.goto('/trips/private/edit');
  await expect(page).toHaveURL('http://localhost:4300/onboarding');
  await expect(page.locator('input')).toHaveCount(1);
  await page.getByLabel('닉네임', { exact: true }).fill('  바다여행  ');
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page).toHaveURL('http://localhost:4300/trips');
  expect(saved).toBe('바다여행');
  await page.reload();
  await expect(page.getByTestId('new-trip')).toBeVisible();
  await page.getByRole('link', { name: '내 정보', exact: true }).click();
  await expect(page.getByTestId('login-account')).toContainText('바다여행');
});

test('닉네임 검증과 저장 실패는 토스트로 알리고 입력을 보존', async ({ page }) => {
  let calls = 0;
  await page.route(`${authUrl}/auth/v1/user**`, (route) => {
    calls++;
    return route.fulfill({ status: 400, json: { msg: 'Profile unavailable' } });
  });
  await page.goto('/login');
  await expect(page).toHaveURL('http://localhost:4300/onboarding');
  await page.getByLabel('닉네임', { exact: true }).fill('가');
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page.getByRole('alert')).toContainText('2~20자');
  expect(calls).toBe(0);
  await page.getByLabel('닉네임', { exact: true }).fill('여행친구');
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page.getByRole('alert')).toContainText('저장하지 못했습니다');
  await expect(page.getByLabel('닉네임', { exact: true })).toHaveValue('여행친구');
  await expect(page).toHaveURL('http://localhost:4300/onboarding');
  expect(calls).toBe(1);
});
