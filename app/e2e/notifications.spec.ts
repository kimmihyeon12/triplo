import { expect, test } from '@playwright/test';
import { resetApp } from './helpers';

/**
 * 알림 설정(2026-10-01). 테스트 앱은 실제 푸시 구독 없이 켬·끔과 설정을 기기에 남긴다.
 * 실제 발송은 서버 검증(supabase/tests/push.local.sql)과 발송 함수 단위 테스트가 맡는다.
 */
test.beforeEach(async ({ page }) => {
  await resetApp(page);
});

test('이 기기에서 알림을 켜고 끄며 새로 열어도 남는다', async ({ page }) => {
  await page.goto('/account/notifications');
  const device = page.getByTestId('push-device');
  await expect(device).toHaveAttribute('aria-checked', 'false');
  await device.click();
  await expect(device).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(page.getByTestId('push-device')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('push-device').click();
  await expect(page.getByTestId('push-device')).toHaveAttribute('aria-checked', 'false');
});

test('받을 알림 종류를 바로 바꾸고 새로 열어도 남는다', async ({ page }) => {
  await page.goto('/account/notifications');
  const together = page.getByTestId('push-kind-together');
  await expect(together).toHaveAttribute('aria-checked', 'true');
  await together.click();
  await expect(together).toHaveAttribute('aria-checked', 'false');
  await page.reload();
  await expect(page.getByTestId('push-kind-together')).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('push-kind-replies')).toHaveAttribute('aria-checked', 'true');
});

test('권한을 막았거나 아이폰 탭이면 켤 수 없고 방법을 알린다', async ({ page }) => {
  await page.goto('/account/notifications');
  await page.getByTestId('push-device').click();
  await expect(page.getByTestId('push-device')).toHaveAttribute('aria-checked', 'true');
  // 테스트 앱의 기기 상태 열쇠를 바꿔 각 상태를 흉내 낸다.
  const setState = (state: string) =>
    page.evaluate((value) => {
      const key = Object.keys(localStorage).find((k) => k.includes('.push.') && k.endsWith('.device'))!;
      localStorage.setItem(key, value);
    }, state);
  await setState('denied');
  await page.reload();
  await expect(page.getByTestId('push-device')).toBeDisabled();
  await expect(page.getByTestId('push-denied')).toBeVisible();
  await setState('install-required');
  await page.reload();
  await expect(page.getByTestId('push-install')).toContainText('홈 화면에 설치한 앱');
  await expect(page.getByTestId('push-install').getByRole('link')).toHaveAttribute('href', '/install');
});
