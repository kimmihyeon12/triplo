import { expect, test } from '@playwright/test';
import { addStop, createTrip, resetApp } from './helpers';

/**
 * 테스트 앱은 외부 호출 없는 픽스처 검색·지도를 쓴다.
 * 여기서 확인하는 것은 화면 흐름(검색→선택→저장→마커·카드 동기화)이며 실제 카카오 연동 검증은 별도다.
 */
test.describe('장소 검색으로 위치 확인, 날짜별 지도 마커', () => {
  test.beforeEach(async ({ page }) => resetApp(page));

  test('검색 결과를 고르면 좌표가 저장되고 지도에 순번 마커와 안내선이 그려진다', async ({ page }) => {
    const id = await createTrip(page, { title: '강릉 지도', start: '2026-05-01', end: '2026-05-02', regions: ['강릉'] });

    // 1) 검색 → 선택 → 저장
    await page.goto(`/trips/${id}/stops/new?date=2026-05-01`);
    await page.getByTestId('place-query').fill('안목');
    await page.getByTestId('place-search-btn').click();
    await expect(page.getByTestId('place-results')).toContainText('안목해변');
    await page.getByTestId('place-result-f-anmok').click();
    await expect(page.getByTestId('stop-name')).toHaveValue('안목해변');
    await expect(page.getByTestId('stop-address')).toHaveValue('강원 강릉시 창해로14번길 20-1');
    await expect(page.getByTestId('stop-location-verified')).toContainText('위치 확인됨 · 테스트 픽스처');
    await page.getByTestId('stop-save').click();

    // 카드에 위치 확인됨, 지도에 마커 1개(안내선 없음)
    await expect(page.getByTestId('day-items')).toContainText('위치 확인됨');
    await expect(page.getByTestId('trip-map')).toHaveAttribute('data-state', 'ready');
    await expect(page.getByTestId('map-marker-' + (await stopIdByName(page, '안목해변')))).toHaveText('1');
    await expect(page.getByTestId('map-guideline')).toHaveAttribute('data-points', '0');

    // 2) 두 번째 검색 장소 → 마커 2개, 안내선 2점
    await page.goto(`/trips/${id}/stops/new?date=2026-05-01`);
    await page.getByTestId('place-query').fill('오죽헌');
    await page.getByTestId('place-query').press('Enter');
    await page.getByTestId('place-result-f-ojukheon').click();
    await page.getByTestId('stop-save').click();
    await expect(page.getByTestId('fixture-map').locator('[data-kind="stop"]')).toHaveCount(2);
    await expect(page.getByTestId('map-guideline')).toHaveAttribute('data-points', '2');

    // 3) 검색 없이 직접 입력한 항목은 지도에 없고 '지도에 없음' 표시
    await addStop(page, id, { name: '직접 입력 카페', date: '2026-05-01', stayMinutes: 30 });
    await expect(page.getByTestId('fixture-map').locator('[data-kind="stop"]')).toHaveCount(2);
    await expect(page.getByTestId('map-unverified')).toContainText('지도에 없음 1개');
    const manualId = await stopIdByName(page, '직접 입력 카페');
    await expect(page.getByTestId('badge-' + manualId)).toHaveText('3');

    // 4) 마커 클릭 → 카드 강조, 순번 클릭 → 마커 강조
    const anmokId = await stopIdByName(page, '안목해변');
    await page.getByTestId('map-marker-' + anmokId).click();
    await expect(page.getByTestId('stop-' + anmokId)).toHaveClass(/item--selected/);
    const ojukId = await stopIdByName(page, '오죽헌');
    await page.getByTestId('badge-' + ojukId).click();
    await expect(page.getByTestId('map-marker-' + ojukId)).toHaveClass(/tc-marker--on/);
    await expect(page.getByTestId('map-marker-' + anmokId)).not.toHaveClass(/tc-marker--on/);

    // 5) 다른 날짜로 이동하면 그날 마커만(없음)
    await page.getByTestId('daytab-2').click();
    await expect(page.getByTestId('map-empty')).toBeVisible();

    // 6) 재열기 후에도 좌표 유지
    await page.reload();
    await page.getByTestId('daytab-1').click();
    await expect(page.getByTestId('fixture-map').locator('[data-kind="stop"]')).toHaveCount(2);
  });

  test('검색 결과가 없으면 안내를 보여주고 직접 입력으로 저장할 수 있다', async ({ page }) => {
    const id = await createTrip(page, { start: '2026-05-01', end: '2026-05-01' });
    await page.goto(`/trips/${id}/stops/new`);
    await page.getByTestId('place-query').fill('존재하지않는장소');
    await page.getByTestId('place-search-btn').click();
    await expect(page.getByTestId('place-search-empty')).toBeVisible();
    await page.getByTestId('stop-name').fill('우리 집');
    await page.getByTestId('stop-date').selectOption('2026-05-01');
    await page.getByTestId('stop-save').click();
    await expect(page.getByTestId('day-items')).toContainText('위치 미확인');
  });

  test('위치 지우기는 이름·주소를 남기고 좌표만 없앤다', async ({ page }) => {
    const id = await createTrip(page, { start: '2026-05-01', end: '2026-05-01' });
    await page.goto(`/trips/${id}/stops/new?date=2026-05-01`);
    await page.getByTestId('place-query').fill('오죽헌');
    await page.getByTestId('place-search-btn').click();
    await page.getByTestId('place-result-f-ojukheon').click();
    await page.getByTestId('stop-location-clear').click();
    await expect(page.getByTestId('stop-location-verified')).toHaveCount(0);
    await expect(page.getByTestId('stop-name')).toHaveValue('오죽헌');
    await page.getByTestId('stop-save').click();
    await expect(page.getByTestId('day-items')).toContainText('위치 미확인');
    await expect(page.getByTestId('map-empty')).toBeVisible();
  });

  test('숙소를 검색으로 등록하면 숙소 탭과 날짜별 지도에 숙소 마커가 보인다', async ({ page }) => {
    const id = await createTrip(page, { start: '2026-05-01', end: '2026-05-03' });
    await page.goto(`/trips/${id}/stays/new`);
    await page.getByTestId('place-query').fill('테스트 호텔');
    await page.getByTestId('place-search-btn').click();
    await page.getByTestId('place-result-f-hotel-a').click();
    await expect(page.getByTestId('stay-name')).toHaveValue('강릉 테스트 호텔');
    await expect(page.getByTestId('stay-location-verified')).toBeVisible();
    await page.getByTestId('stay-checkin').fill('2026-05-01');
    await page.getByTestId('stay-checkout').fill('2026-05-03');
    await page.getByTestId('stay-save').click();

    await expect(page.getByTestId('panel-stays')).toBeVisible();
    await expect(page.getByTestId('stay-list')).toContainText('위치 확인됨');
    await expect(page.getByTestId('fixture-map').locator('[data-kind="stay"]')).toHaveCount(1);

    await page.getByTestId('tab-days').click();
    await expect(page.getByTestId('fixture-map').locator('[data-kind="stay"]')).toHaveCount(1);
    await expect(page.getByTestId('map-empty')).toHaveCount(0);
  });
});

async function stopIdByName(page: import('@playwright/test').Page, name: string): Promise<string> {
  const card = page.getByTestId('day-items').locator('li.item', { hasText: name }).first();
  const testId = await card.getAttribute('data-testid');
  if (!testId) throw new Error('카드를 찾지 못함: ' + name);
  return testId.replace('stop-', '');
}

test.describe('지도 상태: 로딩·오류', () => {
  test.beforeEach(async ({ page }) => resetApp(page));

  test('지도 로드가 느리면 로딩 상태를, 실패하면 오류 상태를 보여주고 일정 편집은 계속 된다', async ({ page }) => {
    const id = await createTrip(page, { start: '2026-05-01', end: '2026-05-01' });
    await page.evaluate(() => localStorage.setItem('tc.test.mapDelayMs', '1500'));
    await page.goto(`/trips/${id}?tab=days`);
    await expect(page.getByTestId('map-loading')).toBeVisible();
    await expect(page.getByTestId('trip-map')).toHaveAttribute('data-state', 'ready', { timeout: 5000 });

    await page.evaluate(() => {
      localStorage.removeItem('tc.test.mapDelayMs');
      localStorage.setItem('tc.test.mapFail', '1');
    });
    await page.reload();
    await expect(page.getByTestId('map-error')).toContainText('지도를 표시하지 못했습니다');
    await expect(page.getByTestId('trip-map')).toHaveAttribute('data-state', 'error');
    // 지도 오류와 무관하게 장소 추가는 가능
    await page.getByTestId('add-stop').click();
    await expect(page.getByTestId('stop-name')).toBeVisible();
    await page.evaluate(() => localStorage.removeItem('tc.test.mapFail'));
  });
});
