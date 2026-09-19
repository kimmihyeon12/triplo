import { expect, test } from '@playwright/test';
import { addStop, createTrip, resetApp } from './helpers';

/**
 * 방문 통계 지도를 검증한다.
 *
 * 방문 판정은 여행 종료일이 오늘보다 이전인지로 한다. 따라서 과거 날짜로
 * 여행을 만들어야 통계에 잡힌다.
 */

test.beforeEach(async ({ page }) => {
  await resetApp(page);
});

test('다녀온 여행이 없으면 빈 상태를 보여준다', async ({ page }) => {
  await page.goto('/stats/details');
  await expect(page.getByTestId('stats-empty')).toBeVisible();
  await expect(page.getByTestId('block-map')).toHaveCount(0);
});

test('날짜가 지나지 않은 여행은 통계에 넣지 않는다', async ({ page }) => {
  const id = await createTrip(page, {
    title: '앞으로 갈 여행',
    start: '2030-05-01',
    end: '2030-05-03',
    regions: ['강릉'],
  });
  await addStop(page, id, { name: '안목해변', region: '강릉', date: '2030-05-01' });

  await page.goto('/stats/details');
  await expect(page.getByTestId('stats-empty')).toBeVisible();
});

test('지난 여행의 장소를 지역별로 센다', async ({ page }) => {
  const id = await createTrip(page, {
    title: '강릉 여행',
    start: '2024-05-01',
    end: '2024-05-03',
    regions: ['강릉'],
  });
  await addStop(page, id, { name: '안목해변', region: '강릉', date: '2024-05-01' });
  await addStop(page, id, { name: '경포대', region: '강릉', date: '2024-05-02' });

  await page.goto('/stats/details');
  await expect(page.getByTestId('stats-summary')).toContainText('2');
  // 지도를 읽을 수 없어도 같은 값을 볼 수 있어야 한다.
  await expect(page.getByTestId('block-map-list')).toContainText('강릉');
  await expect(page.getByTestId('block-map-list')).toContainText('2회');
});

test('지역을 고르면 그곳에서 방문한 장소를 보여준다', async ({ page }) => {
  const id = await createTrip(page, {
    title: '강릉 여행',
    start: '2024-05-01',
    end: '2024-05-03',
    regions: ['강릉'],
  });
  await addStop(page, id, { name: '안목해변', region: '강릉', date: '2024-05-01' });

  await page.goto('/stats/details');
  await page.getByTestId('block-map-list').getByRole('button', { name: /강릉/ }).click();

  await expect(page.getByTestId('stats-places')).toContainText('안목해변');
  // 방문으로 본 근거인 여행 종료일을 함께 보여준다.
  await expect(page.getByTestId('stats-places')).toContainText('2024-05-03');
});

test('장소를 누르면 그 여행으로 간다', async ({ page }) => {
  const id = await createTrip(page, {
    title: '강릉 여행',
    start: '2024-05-01',
    end: '2024-05-03',
    regions: ['강릉'],
  });
  await addStop(page, id, { name: '안목해변', region: '강릉', date: '2024-05-01' });

  await page.goto('/stats/details');
  await page.getByTestId('block-map-list').getByRole('button', { name: /강릉/ }).click();
  await page.getByTestId('stats-places').getByRole('button').first().click();

  await expect(page).toHaveURL(new RegExp(`/trips/${id}$`));
});

test('서울은 자치구 지도를 한 단계 더 보여준다', async ({ page }) => {
  const id = await createTrip(page, {
    title: '서울 여행',
    start: '2024-05-01',
    end: '2024-05-03',
    regions: ['서울'],
  });
  // 자치구는 주소에서 읽는다. 지역 목록에는 '서울'만 담기기 때문이다.
  await addStop(page, id, {
    name: '코엑스',
    address: '서울 강남구 삼성동 159',
    date: '2024-05-01',
  });

  await page.goto('/stats/details');
  await page.getByTestId('block-map-list').getByRole('button', { name: /서울/ }).click();

  // 전국이 아니라 서울 안을 보고 있다.
  await expect(page.getByTestId('block-map-list')).toContainText('강남구');

  await page.getByTestId('block-map-list').getByRole('button', { name: /강남구/ }).click();
  await expect(page.getByTestId('stats-places')).toContainText('코엑스');
});

test('전국 지도로 돌아간다', async ({ page }) => {
  const id = await createTrip(page, {
    title: '강릉 여행',
    start: '2024-05-01',
    end: '2024-05-03',
    regions: ['강릉'],
  });
  await addStop(page, id, { name: '안목해변', region: '강릉', date: '2024-05-01' });

  await page.goto('/stats/details');
  await page.getByTestId('block-map-list').getByRole('button', { name: /강릉/ }).click();
  await page.getByTestId('stats-back').click();

  await expect(page.getByTestId('stats-summary')).toBeVisible();
});

test('여행 목록에서 통계로 간다', async ({ page }) => {
  await createTrip(page, { title: '아무 여행', start: '2024-05-01', end: '2024-05-03' });

  await page.goto('/trips');
  await page.getByTestId('go-stats').click();
  await expect(page).toHaveURL(/\/stats$/);
});
