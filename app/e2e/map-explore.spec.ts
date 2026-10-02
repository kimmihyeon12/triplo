import { expect, test, type Page } from '@playwright/test';
import { createTrip, expectNoHorizontalScroll, resetApp, chooseOption } from './helpers';

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
  await chooseOption(page, 'stop-date', '2026-05-01');
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
  await expect(page.getByTestId('map-explore-day')).toHaveAttribute('data-value', '2026-05-01');
  await chooseOption(page, 'map-explore-day', '2026-05-02');
  await page.getByTestId('map-explore-add').click();
  await expect(page.getByTestId('success-toast')).toContainText('2일차 맨 아래 후보로 담았어요');
  await expect(page.getByTestId('map-explore-add')).toHaveText('담았어요');
  // 후보로 담은 곳은 여행 상세처럼 회색 눈으로 보인다.
  await expect(page.getByTestId('map-place-n-grill')).toHaveAttribute('aria-label', /후보로 담음/);
  await expect(page.getByTestId('map-place-n-grill')).toHaveClass(/tc-pin--candidate/);
  // 분류 색(녹색) 대신 연회색 바탕이다(2026-10-01 사용자 지적).
  const ground = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'bg-ground-2';
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
  await expect(page.getByTestId('map-place-n-grill')).toHaveCSS('background-color', ground);

  await page.goto(`/trips/${id}?day=2026-05-02`);
  await expect(page.locator('[data-testid^=stop-]').getByText('테스트 회센터').first()).toBeVisible();
  // 후보(제외)는 흐리게 보이지만 지도 앱 아이콘은 그대로다(2026-10-01 사용자 요청).
  const item = page.locator('.item--excluded').filter({ hasText: '테스트 회센터' }).first();
  await expect(item.locator('.item__name')).toHaveCSS('opacity', '0.5');
  await expect(item.locator('[data-maps]')).toHaveCSS('opacity', '1');
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
  await page.getByTestId('map-day-select').click();
  await page.getByTestId('map-day-2026-05-02').click();
  await expect(page.getByTestId('map-day-select')).toContainText('2일차');
  // 2일차에는 담은 곳이 없다.
  await expect(page.locator('[data-testid^=map-marker-]')).toHaveCount(0);
  await page.getByTestId('map-day-select').click();
  await page.getByTestId('map-day-2026-05-01').click();
  await expect(page.locator('[data-testid^=map-marker-]')).toHaveCount(1);
  await page.getByTestId('map-day-select').click();
  await page.getByTestId('map-day-2026-05-02').click();
  await page.getByTestId('map-category-cafe').click();
  await page.getByTestId('map-place-n-cafe').click();
  await expect(page.getByTestId('map-explore-day')).toHaveAttribute('data-value', '2026-05-02');
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

test('장소 이름으로 찾아 그 자리로 옮기고 바로 담을 수 있다', async ({ page }) => {
  const id = await tripWithAnmok(page);
  await page.goto(`/trips/${id}/map`);
  await page.getByTestId('map-search-input').fill('오죽헌');
  await page.getByTestId('map-search-go').click();
  await page.getByTestId('map-search-result-f-ojukheon').click();
  await expect(page.getByTestId('map-search-results')).toHaveCount(0);
  await expect(page.getByTestId('map-explore-name')).toHaveText('오죽헌');
  await expect(page.locator('[data-testid=fixture-map] .tc-fixture-map__layer').first()).toHaveAttribute('data-centered-on', '37.7793,128.878');
  await expect(page.getByTestId('map-place-f-ojukheon')).toBeVisible();
  await page.getByTestId('map-search-input').fill('없는곳이름');
  await page.getByTestId('map-search-go').click();
  await expect(page.getByTestId('map-search-empty')).toBeVisible();
  // 지도를 옮기면 찾기 결과 목록만 닫히고 정보판은 남는다.
  await moveMap(page, { south: 37.76, north: 37.8, west: 128.86, east: 128.9 });
  await expect(page.getByTestId('map-search-results')).toHaveCount(0);
  await expect(page.getByTestId('map-explore-sheet')).toBeVisible();
});

test('확대·축소와 현재 위치로 옮기기', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 37.7735, longitude: 128.948 });
  const id = await tripWithAnmok(page);
  await page.goto(`/trips/${id}/map`);
  const layer = page.locator('[data-testid=fixture-map] .tc-fixture-map__layer').first();
  await page.getByTestId('map-zoom-in').click();
  await expect(layer).toHaveAttribute('data-zoom', '1');
  await page.getByTestId('map-zoom-out').click();
  await page.getByTestId('map-zoom-out').click();
  await expect(layer).toHaveAttribute('data-zoom', '-1');
  await page.getByTestId('map-locate').click();
  await expect(page.getByTestId('my-location')).toBeVisible();
  await expect(layer).toHaveAttribute('data-centered-on', '37.7735,128.948');
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
