import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, resetApp } from './helpers';

/** 구름이가 안내하는 사용법(2026-10-01). */
test.beforeEach(async ({ page }) => {
  await resetApp(page);
});

test('내 정보에서 사용법을 열고 설명 번호를 눌러 그 자리를 본다', async ({ page }) => {
  await page.goto('/account');
  await page.getByTestId('go-guide').click();
  await expect(page).toHaveURL(/\/account\/guide$/);
  await expect(page.getByTestId('guide-step')).toHaveText('1 / 12');
  await expect(page.getByTestId('guide-image')).toHaveAttribute('src', '/guide/01-trips.jpg');
  const legend = page.getByTestId('guide-legend').getByRole('button');
  await expect(legend.first()).toContainText('AI가 코스를 짜 줘요');
  await legend.first().click();
  await expect(legend.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('guide-mark-1')).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test('끝까지 넘기면 시작하기로 바뀌고 내 정보로 돌아간다', async ({ page }) => {
  await page.goto('/account/guide');
  for (let i = 1; i < 12; i++) await page.getByTestId('guide-next').click();
  await expect(page.getByTestId('guide-step')).toHaveText('12 / 12');
  await expect(page.getByTestId('guide-next')).toHaveText('시작하기');
  await page.getByTestId('guide-next').click();
  await expect(page).toHaveURL(/\/account$/);
});

test('키보드 화살표로 넘기고 이전으로 돌아간다', async ({ page }) => {
  await page.goto('/account/guide');
  await page.getByTestId('guide').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('guide-step')).toHaveText('2 / 12');
  await page.getByTestId('guide-prev').click();
  await expect(page.getByTestId('guide-step')).toHaveText('1 / 12');
  await expect(page.getByTestId('guide-prev')).toBeDisabled();
});

test('처음 가입한 흐름(?first=1)은 건너뛰면 여행 목록으로 간다', async ({ page }) => {
  await page.goto('/account/guide?first=1');
  await page.getByTestId('guide-skip').click();
  await expect(page).toHaveURL(/\/trips$/);
});
