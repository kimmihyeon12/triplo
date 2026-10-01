import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, resetApp } from './helpers';

/** 앱 사용법(2026-10-01): HTML로 그린 앱 화면 위에 회색 덮개와 설명 글. */
test.beforeEach(async ({ page }) => {
  await resetApp(page);
});

test('내 정보에서 사용법을 열면 화면 위에 설명 글이 보이고 끌어서 넘긴다', async ({ page }) => {
  await page.goto('/account');
  await page.getByTestId('go-guide').click();
  await expect(page).toHaveURL(/\/account\/guide$/);
  await expect(page.getByTestId('guide-step')).toHaveText('1 / 14');
  await expect(page.getByTestId('guide-title')).toHaveText('여행 목록');
  const first = page.getByTestId('guide-slide').first().getByTestId('guide-callout');
  await expect(first).toHaveCount(5);
  await expect(first.first()).toContainText('AI가 코스를 짜 줘요');
  await expect(first.first()).toBeInViewport();
  await expectNoHorizontalScroll(page);

  const stage = await page.getByTestId('guide-stage').boundingBox();
  const y = stage!.y + stage!.height / 2;
  await page.mouse.move(stage!.x + stage!.width - 20, y);
  await page.mouse.down();
  await page.mouse.move(stage!.x + 20, y, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId('guide-step')).toHaveText('2 / 14');
  await expect(page.getByTestId('guide-title')).toHaveText('일정 짜기 ①');
});

test('끝까지 넘기면 시작하기로 바뀌고 내 정보로 돌아간다', async ({ page }) => {
  await page.goto('/account/guide');
  for (let i = 1; i < 14; i++) await page.getByTestId('guide-next').click();
  await expect(page.getByTestId('guide-step')).toHaveText('14 / 14');
  await expect(page.getByTestId('guide-next')).toHaveText('시작하기');
  await page.getByTestId('guide-next').click();
  await expect(page).toHaveURL(/\/account$/);
});

test('키보드 화살표로 넘기고 이전으로 돌아간다', async ({ page }) => {
  await page.goto('/account/guide');
  await page.getByTestId('guide').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('guide-step')).toHaveText('2 / 14');
  await page.getByTestId('guide-prev').click();
  await expect(page.getByTestId('guide-step')).toHaveText('1 / 14');
  await expect(page.getByTestId('guide-prev')).toBeDisabled();
});

test('처음 가입한 흐름(?first=1)은 건너뛰면 여행 목록으로 간다', async ({ page }) => {
  await page.goto('/account/guide?first=1');
  await page.getByTestId('guide-skip').click();
  await expect(page).toHaveURL(/\/trips$/);
});
