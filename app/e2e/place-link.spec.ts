import { expect, test } from '@playwright/test';
import { createTrip, expectNoHorizontalScroll, resetApp } from './helpers';

/**
 * 지도 링크로 장소 담기(2026-10-01). 테스트 앱은 고정 응답을 쓴다(fixture-place-link-resolver).
 * 카카오 검색에 같은 곳이 있으면 그 후보로, 없으면 링크의 값(네이버)으로 담긴다.
 */
test.beforeEach(async ({ page }) => {
  await resetApp(page);
});

async function openStopForm(page: import('@playwright/test').Page): Promise<string> {
  const id = await createTrip(page, { title: '링크 여행', start: '2026-05-01', end: '2026-05-01' });
  await page.goto(`/trips/${id}/stops/new`);
  await page.getByTestId('place-link-toggle').click();
  return id;
}

test('카카오 검색에 없는 장소는 링크의 주소·좌표로 담고 출처를 네이버로 보인다', async ({ page }) => {
  await openStopForm(page);
  await page.getByTestId('place-link-url').fill('https://naver.me/test-not-in-kakao');
  await page.getByTestId('place-link-find').click();
  await expect(page.getByTestId('stop-name')).toHaveValue('신가회전훠궈 수원역점');
  await expect(page.getByTestId('stop-location-verified')).toContainText('네이버');
  await expect(page.getByTestId('stop-location-verified')).toContainText('37.26863, 127.00377');
  await expect(page.getByTestId('place-link-url')).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  await page.getByTestId('stop-save').click();
  await expect(page.getByText('신가회전훠궈 수원역점')).toBeVisible();
});

test('카카오 검색에 같은 곳이 있으면 검색 후보로 담는다', async ({ page }) => {
  await openStopForm(page);
  await page.getByTestId('place-link-url').fill('https://naver.me/test-in-kakao');
  await page.getByTestId('place-link-find').click();
  await expect(page.getByTestId('stop-name')).toHaveValue('안목해변');
  // 테스트 앱의 검색 제공자는 고정 목록이다. 실제 앱에서는 '카카오'로 보인다.
  await expect(page.getByTestId('stop-location-verified')).toContainText('테스트 픽스처');
});

test('지도 링크가 아니거나 장소를 읽지 못하면 이유를 보이고 검색으로 이어 간다', async ({ page }) => {
  await openStopForm(page);
  await page.getByTestId('place-link-url').fill('https://example.com/place');
  await page.getByTestId('place-link-find').click();
  await expect(page.getByTestId('place-link-error')).toHaveText('네이버·카카오 지도 링크만 담을 수 있어요.');
  await page.getByTestId('place-link-url').fill('https://naver.me/test-broken');
  await expect(page.getByTestId('place-link-error')).toHaveCount(0);
  await page.getByTestId('place-link-find').click();
  await expect(page.getByTestId('place-link-error')).toHaveText('장소를 읽지 못했어요. 이름으로 검색해 주세요.');
  await expect(page.getByTestId('stop-location-verified')).toHaveCount(0);
  await expect(page.getByTestId('place-query')).toBeEnabled();
});
