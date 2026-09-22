import { expect, test, type Page } from '@playwright/test';
import { FAIL_FLAG, STORAGE_KEY, resetApp } from './helpers';

/**
 * AI 일정 만들기. 테스트 앱은 외부를 부르지 않는 픽스처 제공자를 쓴다.
 * 픽스처는 안목해변·오죽헌·속초관광수산시장을 찾고 '없는장소테스트'는 찾지 못한다.
 */

const AI_FAIL = 'tc.test.aiFail';
const AI_DELAY = 'tc.test.aiDelayMs';

/** 조건 세 단계를 지나 요약 화면까지 간다. */
async function fillConditions(page: Page, start: string, end: string): Promise<void> {
  await page.goto('/trips/ai');
  await page.getByTestId('ai-region-input').fill('강릉');
  await page.getByTestId('ai-region-match-강릉').click();
  await page.getByTestId('ai-start').fill(start);
  await page.getByTestId('ai-end').fill(end);
  await page.getByTestId('ai-next-1').click();
  await page.getByTestId('ai-next-2').click();
  await page.getByTestId('ai-next-3').click();
}

function savedTrips(page: Page): Promise<{ stops: { name: string; date: string | null; location: unknown; address: string }[] }[]> {
  return page.evaluate(async (key) => {
    const raw = localStorage.getItem(key);
    const saved = JSON.parse(raw!) as { trips: Record<string, unknown> };
    return Object.values(saved.trips) as never;
  }, STORAGE_KEY);
}

test('위치를 확인한 장소만 보이고 좌표와 함께 담긴다', async ({ page }) => {
  await resetApp(page);
  await fillConditions(page, '2026-05-01', '2026-05-02');
  await page.getByTestId('ai-generate').click();
  await expect(page.getByTestId('ai-result')).toBeVisible();

  // 검색으로 찾은 장소만 목록에 오른다. 찾지 못한 이름은 들이지 않는다.
  await expect(page.getByTestId('ai-result')).toContainText('안목해변');
  await expect(page.getByTestId('ai-result')).not.toContainText('없는장소테스트');
  await expect(page.getByTestId('ai-pick-ai-0')).toBeChecked();
  await expect(page.getByTestId('ai-commit')).toContainText('3개 담기');

  // 검색에서 온 주소가 보인다. 모델이 쓴 설명이 아니다.
  await expect(page.getByTestId('ai-result')).toContainText('강원 강릉시 창해로14번길');

  await page.getByTestId('ai-commit').click();
  await expect(page.getByTestId('trip-header')).toBeVisible();

  const trips = await savedTrips(page);
  expect(trips).toHaveLength(1);
  expect(trips[0]!.stops).toHaveLength(3);
  // 담은 장소에는 좌표와 주소가 함께 저장된다. 지도에 바로 올라간다.
  expect(trips[0]!.stops.every((s) => s.location !== null)).toBe(true);
  expect(trips[0]!.stops.every((s) => s.address !== '')).toBe(true);
});

test('선택을 해제하면 그 장소만 빠지고 조건은 그대로 남는다', async ({ page }) => {
  await resetApp(page);
  await page.goto('/trips/ai');
  await page.getByTestId('ai-region-input').fill('강릉');
  await page.getByTestId('ai-region-match-강릉').click();
  await page.getByTestId('ai-start').fill('2026-05-01');
  await page.getByTestId('ai-end').fill('2026-05-02');
  await page.getByTestId('ai-next-1').click();
  await page.getByTestId('ai-taste').fill('바다');
  await page.getByTestId('ai-next-2').click();
  await page.getByTestId('ai-next-3').click();
  await expect(page.getByTestId('ai-summary')).toContainText('바다');

  await page.getByTestId('ai-generate').click();
  await page.getByTestId('ai-pick-ai-0').uncheck();
  await page.getByTestId('ai-back-summary').click();
  // 조건 고치기로 돌아와도 입력은 남는다.
  await expect(page.getByTestId('ai-summary')).toContainText('바다');

  await page.getByTestId('ai-generate').click();
  await expect(page.getByTestId('ai-result')).toBeVisible();

  await page.evaluate((flag) => localStorage.setItem(flag, '1'), FAIL_FLAG);
  await page.getByTestId('ai-commit').click();
  await expect(page.getByRole('alert')).toContainText('저장에 실패');
  await page.evaluate((flag) => localStorage.removeItem(flag), FAIL_FLAG);
  await page.getByTestId('ai-commit').click();
  await expect(page.getByTestId('trip-header')).toBeVisible();
  // 재시도해도 여행은 하나만 만들어진다.
  expect(await savedTrips(page)).toHaveLength(1);
});

test('만드는 동안 기다림을 보여주고 그만둘 수 있다', async ({ page }) => {
  await resetApp(page);
  await page.evaluate((flag) => localStorage.setItem(flag, '4000'), AI_DELAY);
  await fillConditions(page, '2026-05-01', '2026-05-02');
  await page.getByTestId('ai-generate').click();

  await expect(page.getByTestId('ai-generating')).toBeVisible();
  await page.getByTestId('ai-cancel-generate').click();
  // 그만두면 조건 화면으로 돌아오고 오류를 남기지 않는다.
  await expect(page.getByTestId('ai-summary')).toBeVisible();
  await expect(page.getByTestId('ai-error')).toHaveCount(0);
  await page.evaluate((flag) => localStorage.removeItem(flag), AI_DELAY);
});

test('연결에 실패하면 이유를 보여주고 조건을 남긴다', async ({ page }) => {
  await resetApp(page);
  await page.evaluate((flag) => localStorage.setItem(flag, '1'), AI_FAIL);
  await fillConditions(page, '2026-05-01', '2026-05-02');
  await page.getByTestId('ai-generate').click();

  await expect(page.getByTestId('ai-error')).toBeVisible();
  await expect(page.getByTestId('ai-summary')).toBeVisible();
  // 샘플로 바꿔치지 않는다.
  await expect(page.getByTestId('ai-result')).toHaveCount(0);
  await expect(page.getByTestId('ai-generate')).toContainText('다시 시도');

  // 복구하면 다시 만들 수 있다.
  await page.evaluate((flag) => localStorage.removeItem(flag), AI_FAIL);
  await page.getByTestId('ai-generate').click();
  await expect(page.getByTestId('ai-result')).toBeVisible();
});

test('추천 일차를 바꾸면 그 날짜로 담기고 지도 링크가 붙는다', async ({ page }) => {
  await resetApp(page);
  await fillConditions(page, '2026-05-01', '2026-05-03');
  await page.getByTestId('ai-generate').click();
  await expect(page.getByTestId('ai-result')).toBeVisible();

  // 일차는 드롭다운으로 고른다. 칩으로 늘어놓으면 긴 여행에서 한 줄을 다 차지한다.
  const daySelect = page.getByTestId('ai-day-ai-0');
  await expect(daySelect).toHaveValue('1');
  await daySelect.selectOption('3');
  await expect(daySelect).toHaveValue('3');

  // 확인된 장소는 주소로 찾아 같은 이름의 다른 곳이 나오지 않게 한다.
  await expect(page.getByTestId('ai-naver-ai-0')).toHaveAttribute(
    'href',
    /map\.naver\.com\/p\/search\//,
  );
  await expect(page.getByTestId('ai-kakao-ai-0')).toHaveAttribute('href', /map\.kakao\.com/);

  await page.getByTestId('ai-commit').click();
  await expect(page.getByTestId('trip-header')).toBeVisible();
  const trips = await savedTrips(page);
  expect(trips[0]!.stops.find((s) => s.name === '안목해변')?.date).toBe('2026-05-03');
});

test('일차를 바꾸면 목록이 일차 순으로 다시 늘어선다', async ({ page }) => {
  await resetApp(page);
  await fillConditions(page, '2026-05-01', '2026-05-03');
  await page.getByTestId('ai-generate').click();
  await expect(page.getByTestId('ai-result')).toBeVisible();

  // 픽스처는 안목해변(1일)·오죽헌(1일)·속초관광수산시장(2일)을 낸다.
  const days = () => page.locator('[data-testid^="ai-day-"]').evaluateAll((els) =>
    els.map((e) => Number((e as HTMLSelectElement).value)),
  );
  expect(await days()).toEqual([1, 1, 2]);

  // 첫 항목을 3일차로 보내면 그 줄이 맨 뒤로 가야 한다.
  await page.getByTestId('ai-day-ai-0').selectOption('3');
  expect(await days()).toEqual([1, 2, 3]);

  // 각 줄의 드롭다운 값이 그 줄의 장소를 따라가야 한다.
  const rows = await page.locator('.pickrow').evaluateAll((els) =>
    els.map((e) => ({
      name: e.querySelector('.item__name')?.textContent?.trim() ?? '',
      day: Number(e.querySelector('select')?.value ?? 0),
    })),
  );
  expect(rows.find((r) => r.name.includes('안목해변'))?.day).toBe(3);
});

test('고를 일차가 하나뿐인 당일 여행에서는 일차 선택을 감춘다', async ({ page }) => {
  await resetApp(page);
  await fillConditions(page, '2026-05-01', '2026-05-01');
  await page.getByTestId('ai-generate').click();
  await expect(page.getByTestId('ai-result')).toBeVisible();
  await expect(page.getByTestId('ai-day-ai-0')).toHaveCount(0);
  // 지도 링크는 일차와 무관하게 남는다.
  await expect(page.getByTestId('ai-naver-ai-0')).toBeVisible();
});
