import { expect, test, type Page } from '@playwright/test';
import { FAIL_FLAG, STORAGE_KEY, resetApp } from './helpers';

/**
 * AI 일정 만들기. 테스트 앱은 외부를 부르지 않는 픽스처 제공자를 쓴다.
 * 픽스처는 안목해변(액티비티)·오죽헌(관광)·강릉 테스트 호텔(숙소)·속초관광수산시장(쇼핑)을 찾고
 * '없는장소테스트'는 찾지 못한다. id는 응답 순서대로 ai-0~ai-4다.
 */

const AI_FAIL = 'tc.test.aiFail';
const AI_DELAY = 'tc.test.aiDelayMs';

test('부산 전체를 한 번에 선택해 생성 조건으로 전달한다', async ({ page }) => {
  await resetApp(page);
  await page.goto('/trips/ai');
  await page.getByTestId('ai-region-input').fill('부산');
  await expect(page.getByTestId('ai-region-matches').getByRole('option').first()).toContainText('부산 전체');
  await page.getByTestId('ai-region-match-부산').click();
  await expect(page.getByTestId('ai-region-list')).toContainText('부산');
  await page.getByTestId('ai-next-1').click();
  await page.getByTestId('ai-next-2').click();
  await page.getByTestId('ai-next-3').click();
  await expect(page.getByTestId('ai-summary')).toContainText('부산');
});

test('인원·예산·추정 요금 기준과 체류시간을 확인하고 저장한다', async ({ page }, testInfo) => {
  await resetApp(page);
  await page.goto('/trips/ai');
  await page.getByTestId('ai-region-input').fill('강릉');
  await page.getByTestId('ai-region-match-강릉시').click();
  await page.getByTestId('ai-start').fill('2026-10-01');
  await page.getByTestId('ai-end').fill('2026-10-02');
  await page.getByTestId('ai-next-1').click();
  await page.getByTestId('ai-party-size').fill('0');
  await expect(page.getByTestId('ai-budget-error')).toBeVisible();
  await expect(page.getByTestId('ai-next-2')).toBeDisabled();
  await page.getByTestId('ai-party-size').fill('2');
  await page.getByTestId('ai-budget').fill('4000');
  await page.getByTestId('ai-budget-basis').selectOption('person');
  await page.screenshot({ path: testInfo.outputPath('budget-input.png'), fullPage: true });
  await page.getByTestId('ai-next-2').click();
  await page.getByTestId('ai-next-3').click();
  await expect(page.getByTestId('ai-summary')).toContainText('4,000원 · 1인 기준');
  await page.getByTestId('ai-generate').click();
  const summary = page.getByTestId('ai-cost-summary');
  // 안목해변 0원 + 오죽헌 1인 3,000~5,000원 × 2명 + 호텔 1박 90,000~120,000원. 시장은 미정.
  await expect(summary).toContainText('96,000~130,000원');
  await expect(page.getByTestId('ai-budget-groups')).toContainText('미정 1곳');
  await expect(page.getByTestId('ai-budget-remaining')).toContainText('초과');
  await expect(page.getByTestId('ai-estimate-ai-1')).toContainText('1인당 3,000~5,000원 × 2명');
  await expect(page.getByTestId('ai-estimate-ai-1')).toContainText('60~90분');
  await expect(page.getByTestId('ai-day-group-1')).toContainText('오죽헌');
  await expect(page.getByTestId('ai-day-group-2')).toContainText('속초관광수산시장');
  await page.getByTestId('ai-day-ai-1').selectOption('2');
  await expect(page.getByTestId('ai-day-group-1')).not.toContainText('오죽헌');
  await expect(page.getByTestId('ai-day-group-2')).toContainText('오죽헌');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('cost-results.png'), fullPage: true });
  await page.getByTestId('ai-pick-ai-1').uncheck();
  await expect(summary).toContainText('90,000~120,000원');
  await page.getByTestId('ai-pick-ai-1').check();
  await page.getByTestId('ai-commit').click();
  await expect(page.getByTestId('trip-header')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('trip-header')).toBeVisible();
  const stop = await page.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key)!);
    const trips = Object.values(saved.trips) as { stops: { name: string; estimatedCost: number; stayMinutes: number; memo: string }[] }[];
    return trips[0]!.stops.find(s => s.name === '오죽헌');
  }, STORAGE_KEY);
  expect(stop).toMatchObject({ estimatedCost: 10000, stayMinutes: 90 });
  expect(stop?.memo).toContain('AI 추정');
  expect(stop?.memo).toContain('2명');
});

test('시간순 코스와 이동·예산 묶음을 보여 주고 숙소를 숙박으로 담는다', async ({ page }, testInfo) => {
  await resetApp(page);
  await fillConditions(page, '2026-10-01', '2026-10-02');
  await page.getByTestId('ai-generate').click();
  await expect(page.getByTestId('ai-result')).toBeVisible();
  await expect(page.getByTestId('ai-start-ai-0')).toHaveText('10:00 (1시간 30분)');
  await expect(page.getByTestId('ai-leg-ai-1')).toContainText('도보 약 15분 · AI 추정');
  // 오죽헌 다음 항목은 장소 확인에 실패해 빠졌다. 모델 이동은 맞지 않으므로 직선거리만 보인다.
  await expect(page.getByTestId('ai-leg-ai-3')).toContainText('직선');
  await expect(page.getByTestId('ai-leg-ai-3')).not.toContainText('AI 추정');
  await expect(page.getByTestId('ai-price-ai-1')).toContainText('AI 추정');
  await expect(page.getByTestId('ai-price-ai-0')).toContainText('무료');
  await expect(page.getByTestId('ai-estimate-ai-0')).toContainText('요금 기준: 무료');
  // 휴무는 AI 추정으로 밝히고 확인을 권한다. 선택은 그대로 둔다.
  await expect(page.getByTestId('ai-closed-badge-ai-1')).toHaveText('휴무일 · AI 추정');
  await expect(page.getByTestId('ai-closed-ai-1')).toContainText('지도에서 확인');
  await expect(page.getByTestId('ai-pick-ai-1')).toBeChecked();
  await expect(page.getByTestId('ai-budget-groups')).toContainText('숙박');
  await expect(page.getByTestId('ai-budget-groups')).toContainText('관광·액티비티');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('course-results.png'), fullPage: true });
  await page.getByTestId('ai-commit').click();
  await expect(page.getByTestId('trip-header')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('trip-header')).toBeVisible();
  const saved = await page.evaluate((key) => {
    const data = JSON.parse(localStorage.getItem(key)!);
    const trip = Object.values(data.trips)[0] as {
      stops: { name: string; kind: string; memo: string; fixedTime: string | null }[];
      stays: { name: string; checkIn: string; checkOut: string; estimatedCost: number }[];
    };
    return { stops: trip.stops, stays: trip.stays };
  }, STORAGE_KEY);
  expect(saved.stays).toEqual([expect.objectContaining({ name: '강릉 테스트 호텔', checkIn: '2026-10-01', checkOut: '2026-10-02', estimatedCost: 120000 })]);
  expect(saved.stops.map((s) => [s.name, s.kind])).toEqual([['안목해변', 'activity'], ['오죽헌', 'place'], ['속초관광수산시장', 'shopping']]);
  expect(saved.stops[0]!.memo).toContain('AI 추천 시각 10:00');
  expect(saved.stops[1]!.memo).toContain('AI 추정 휴무');
  expect(saved.stops.every((s) => s.fixedTime === null)).toBe(true);
});

/** 조건 세 단계를 지나 요약 화면까지 간다. */
async function fillConditions(page: Page, start: string, end: string): Promise<void> {
  await page.goto('/trips/ai');
  await page.getByTestId('ai-region-input').fill('강릉');
  await page.getByTestId('ai-region-match-강릉시').click();
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
  await expect(page.getByTestId('ai-commit')).toContainText('4개 담기');

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
  await page.getByTestId('ai-region-match-강릉시').click();
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
  // 오류는 토스트 한 곳에서만 알린다. 화면에 같은 문장을 또 띄우지 않고, 고른 항목은 그대로 남는다.
  await expect(page.getByTestId('error-toast')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(1);
  await expect(page.getByTestId('ai-result')).toBeVisible();
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

  // 픽스처는 안목해변·오죽헌·강릉 테스트 호텔(1일)과 속초관광수산시장(2일)을 낸다.
  const days = () => page.locator('select[data-testid^="ai-day-"]').evaluateAll((els) =>
    els.map((e) => Number((e as HTMLSelectElement).value)),
  );
  expect(await days()).toEqual([1, 1, 1, 2]);

  // 첫 항목을 3일차로 보내면 그 줄이 맨 뒤로 가야 한다.
  await page.getByTestId('ai-day-ai-0').selectOption('3');
  expect(await days()).toEqual([1, 1, 2, 3]);

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
