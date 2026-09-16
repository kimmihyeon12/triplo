import { expect, test } from '@playwright/test';
import { FAIL_FLAG, STORAGE_KEY, resetApp } from './helpers';

test('AI 샘플 조건과 선택을 유지하고 저장 실패 후 한 여행에만 담는다', async ({ page }) => {
  await resetApp(page);
  await page.goto('/trips/ai');
  await page.getByTestId('ai-region-input').fill('강릉');
  await page.getByTestId('ai-region-match-강릉').click();
  await page.getByTestId('ai-start').fill('2026-05-01');
  await page.getByTestId('ai-end').fill('2026-05-01');
  await page.getByTestId('ai-next-1').click();
  await page.getByTestId('ai-taste').fill('바다');
  await page.getByTestId('ai-next-2').click();
  await page.getByTestId('ai-next-3').click();
  await expect(page.getByTestId('ai-summary')).toContainText('바다');
  await page.getByTestId('ai-generate').click();
  await expect(page.getByTestId('ai-sample-notice')).toContainText('샘플 결과');
  await page.getByTestId('ai-pick-s1').uncheck();
  await page.getByTestId('ai-back-summary').click();
  await expect(page.getByTestId('ai-summary')).toContainText('바다');
  await page.getByTestId('ai-generate').click();
  await expect(page.getByTestId('ai-pick-s1')).not.toBeChecked();
  await page.evaluate((flag) => localStorage.setItem(flag, '1'), FAIL_FLAG);
  await page.getByTestId('ai-commit').click();
  await expect(page.getByRole('alert')).toContainText('저장에 실패');
  await page.evaluate((flag) => localStorage.removeItem(flag), FAIL_FLAG);
  await page.getByTestId('ai-commit').click();
  await expect(page.getByTestId('trip-header')).toBeVisible();
  const raw = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  const saved = JSON.parse(raw!);
  const trips = Object.values(saved.trips) as {
    stops: { name: string; date: string | null; location: unknown }[];
  }[];
  expect(trips).toHaveLength(1);
  expect(trips[0].stops).toHaveLength(4);
  expect(trips[0].stops.some((s: { name: string }) => s.name === '안목해변 카페거리')).toBe(false);
  expect(trips[0].stops.every((s: { location: unknown }) => s.location === null)).toBe(true);
  expect(trips[0].stops.filter((s: { date: string | null }) => s.date === null)).toHaveLength(2);
});

test('추천 일차를 바꾸면 그 날짜로 담기고 지도 링크가 붙는다', async ({ page }) => {
  await resetApp(page);
  await page.goto('/trips/ai');
  await page.getByTestId('ai-region-input').fill('강릉');
  await page.getByTestId('ai-region-match-강릉').click();
  await page.getByTestId('ai-start').fill('2026-05-01');
  await page.getByTestId('ai-end').fill('2026-05-03');
  await page.getByTestId('ai-next-1').click();
  await page.getByTestId('ai-next-2').click();
  await page.getByTestId('ai-next-3').click();
  await page.getByTestId('ai-generate').click();

  // 2박 3일이므로 일차 칩이 3개다. 1일차 항목을 3일차로 옮긴다.
  await expect(page.getByTestId('ai-day-s1-1')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('ai-day-s1-3').click();
  await expect(page.getByTestId('ai-day-s1-3')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('ai-day-s1-1')).toHaveAttribute('aria-checked', 'false');

  // 지도 링크는 지역을 앞에 붙여 동명 장소가 섞이지 않게 한다.
  await expect(page.getByTestId('ai-naver-s1')).toHaveAttribute(
    'href',
    `https://map.naver.com/p/search/${encodeURIComponent('강릉 안목해변 카페거리')}`,
  );
  await expect(page.getByTestId('ai-kakao-s1')).toHaveAttribute(
    'href',
    `https://map.kakao.com/?q=${encodeURIComponent('강릉 안목해변 카페거리')}`,
  );

  await page.getByTestId('ai-commit').click();
  await expect(page.getByTestId('trip-header')).toBeVisible();
  const raw = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  const trips = Object.values((JSON.parse(raw!) as { trips: Record<string, unknown> }).trips) as {
    stops: { name: string; date: string | null }[];
  }[];
  const moved = trips[0].stops.find((s) => s.name === '안목해변 카페거리');
  expect(moved?.date).toBe('2026-05-03');
});

test('고를 일차가 하나뿐인 당일 여행에서는 일차 선택을 감춘다', async ({ page }) => {
  await resetApp(page);
  await page.goto('/trips/ai');
  await page.getByTestId('ai-region-input').fill('강릉');
  await page.getByTestId('ai-region-match-강릉').click();
  await page.getByTestId('ai-start').fill('2026-05-01');
  await page.getByTestId('ai-end').fill('2026-05-01');
  await page.getByTestId('ai-next-1').click();
  await page.getByTestId('ai-next-2').click();
  await page.getByTestId('ai-next-3').click();
  await page.getByTestId('ai-generate').click();
  await expect(page.getByTestId('ai-result')).toBeVisible();
  await expect(page.getByTestId('ai-day-s1-1')).toHaveCount(0);
  // 지도 링크는 일차와 무관하게 남는다.
  await expect(page.getByTestId('ai-naver-s1')).toBeVisible();
});
