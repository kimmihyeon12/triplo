import { expect, test, type Page } from '@playwright/test';
import { createTrip, expectNoHorizontalScroll, resetApp } from './helpers';

/**
 * 큰 지도에서 주변 장소 골라 담기(2026-10-01). 테스트 지도는 타일 없이 핀을 DOM으로 그리고,
 * 주변 장소는 고정 목록(fixture-place-search의 NEARBY)이다. 지도 이동은 tc-fixture-move 이벤트로 흉내 낸다.
 */
test.beforeEach(async ({ page }) => {
  await resetApp(page);
});

/** 안목해변(위치 확인됨)을 1일차에 담은 여행을 만들고 그 id를 돌려준다. */
async function tripWithAnmok(page: Page): Promise<string> {
  const id = await createTrip(page, { title: '강릉 지도', start: '2026-05-01', end: '2026-05-02', regions: ['강릉시'] });
  await page.goto(`/trips/${id}/stops/new`);
  await page.getByTestId('place-link-toggle').click();
  await page.getByTestId('place-link-url').fill('https://naver.me/test-in-kakao');
  await page.getByTestId('place-link-find').click();
  await expect(page.getByTestId('stop-location-verified')).toBeVisible();
  await page.getByTestId('stop-date').selectOption('2026-05-01');
  await page.getByTestId('stop-save').click();
  await expect(page).toHaveURL(new RegExp(`/trips/${id}(\\?|$)`));
  return id;
}

async function moveMap(page: Page, bounds: { south: number; north: number; west: number; east: number }) {
  await page.getByTestId('fixture-map').evaluate((el, b) => el.dispatchEvent(new CustomEvent('tc-fixture-move', { detail: b })), bounds);
}

test('여행 상세에서 크게 보고, 주변 맛집을 골라 다른 날에 담는다', async ({ page }) => {
  const id = await tripWithAnmok(page);
  await page.getByTestId('open-map-explore').click();
  await expect(page).toHaveURL(new RegExp(`/trips/${id}/map`));
  await expect(page.getByTestId('map-explore')).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.getByTestId('map-category-meal').click();
  await expect(page.getByTestId('map-place-n-grill')).toBeVisible();
  // 지금 보이는 범위 밖(초당)의 맛집은 아직 없다.
  await expect(page.getByTestId('map-place-n-tofu')).toHaveCount(0);

  await page.getByTestId('map-place-n-grill').click();
  await expect(page.getByTestId('map-explore-name')).toHaveText('테스트 회센터');
  // 고른 곳의 카카오맵 평점을 읽어 보인다(저장하지 않는다).
  await expect(page.getByTestId('map-explore-rating')).toHaveText('· ★ 4.4 · 후기 9 · 카카오맵');
  await expect(page.getByTestId('map-explore-day')).toHaveValue('2026-05-01');
  await page.getByTestId('map-explore-day').selectOption('2026-05-02');
  await page.getByTestId('map-explore-add').click();
  await expect(page.getByTestId('success-toast')).toContainText('2일차 맨 아래 후보로 담았어요');
  await expect(page.getByTestId('map-explore-add')).toHaveText('담았어요');
  await expect(page.getByTestId('map-place-n-grill')).toHaveAttribute('aria-label', /담음/);

  await page.goto(`/trips/${id}?day=2026-05-02`);
  await expect(page.locator('[data-testid^=stop-]').getByText('테스트 회센터').first()).toBeVisible();
});

test('지도를 옮기면 이 지역에서 다시 찾고, 숙소는 날짜를 정하는 숙소 화면으로 넘긴다', async ({ page }) => {
  const id = await tripWithAnmok(page);
  await page.goto(`/trips/${id}/map`);
  await page.getByTestId('map-category-meal').click();
  await expect(page.getByTestId('map-place-n-grill')).toBeVisible();
  await expect(page.getByTestId('map-explore-refind')).toHaveCount(0);

  // 초당 쪽으로 옮긴다.
  await moveMap(page, { south: 37.78, north: 37.8, west: 128.9, east: 128.93 });
  await page.getByTestId('map-explore-refind').click();
  await expect(page.getByTestId('map-place-n-tofu')).toBeVisible();

  await page.getByTestId('map-category-stay').click();
  await page.getByTestId('map-place-n-hotel').click();
  await page.getByTestId('map-explore-add').click();
  await expect(page).toHaveURL(new RegExp(`/trips/${id}/stays/new`));
  await expect(page.getByTestId('stay-name')).toHaveValue('강릉 테스트 호텔');
});

test('위 날짜를 바꾸면 그날 일정이 지도에 보이고, 담을 날도 그날로 정해진다', async ({ page }) => {
  const id = await tripWithAnmok(page);
  await page.goto(`/trips/${id}/map`);
  await expect(page.locator('[data-testid^=map-marker-]')).toHaveCount(1);
  await page.getByTestId('map-day-2026-05-02').click();
  await expect(page.getByTestId('map-day-2026-05-02')).toHaveAttribute('aria-selected', 'true');
  // 2일차에는 담은 곳이 없다.
  await expect(page.locator('[data-testid^=map-marker-]')).toHaveCount(0);
  await page.getByTestId('map-day-2026-05-01').click();
  await expect(page.locator('[data-testid^=map-marker-]')).toHaveCount(1);
  await page.getByTestId('map-day-2026-05-02').click();
  await page.getByTestId('map-category-cafe').click();
  await page.getByTestId('map-place-n-cafe').click();
  await expect(page.getByTestId('map-explore-day')).toHaveValue('2026-05-02');
});

test('평점 필터를 켜면 보이는 핀의 평점을 읽어 기준 미만은 숨긴다', async ({ page }) => {
  const id = await tripWithAnmok(page);
  await page.goto(`/trips/${id}/map`);
  // 회센터(4.4)와 순두부(3.8)가 함께 보이게 범위를 넓힌다.
  await moveMap(page, { south: 37.76, north: 37.8, west: 128.9, east: 128.96 });
  await page.getByTestId('map-category-meal').click();
  await expect(page.getByTestId('map-place-n-grill')).toBeVisible();
  await expect(page.getByTestId('map-place-n-tofu')).toBeVisible();
  await page.getByTestId('map-rating-4').click();
  await expect(page.getByTestId('map-place-n-tofu')).toHaveCount(0);
  await expect(page.getByTestId('map-place-n-grill')).toHaveAttribute('aria-label', /평점 4.4/);
  await page.getByTestId('map-rating-4.5').click();
  await expect(page.getByTestId('map-rating-empty')).toHaveText('4.5점 이상인 곳이 없어요.');
  // 같은 기준을 다시 누르면 끈다.
  await page.getByTestId('map-rating-4.5').click();
  await expect(page.getByTestId('map-place-n-tofu')).toBeVisible();
});

test('범위에 장소가 없거나 불러오지 못하면 알린다', async ({ page }) => {
  const id = await tripWithAnmok(page);
  await page.goto(`/trips/${id}/map`);
  await page.getByTestId('map-category-stay').click();
  await expect(page.getByTestId('map-explore-empty')).toBeVisible();
  await page.evaluate(() => localStorage.setItem('tc.test.nearbyFail', '1'));
  await page.getByTestId('map-category-cafe').click();
  await expect(page.getByTestId('map-explore-error')).toBeVisible();
});
