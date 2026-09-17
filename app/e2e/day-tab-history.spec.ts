import { expect, test } from '@playwright/test';
import { createTrip, resetApp } from './helpers';

/**
 * 날짜 탭은 화면 안에서 보는 자리를 바꾸는 일이지 다른 화면으로 가는 일이 아니다.
 * 탭마다 방문 기록이 쌓이면 뒤로가기가 여행 상세를 나가지 못하고 이전 날짜로만
 * 되돌아간다. 휴대폰에서 화면 끝을 쓸어 넘길 때 특히 답답하다.
 */
test.describe('날짜 탭과 뒤로가기', () => {
  test.beforeEach(async ({ page }) => resetApp(page));

  test('날짜를 옮긴 뒤 뒤로가기하면 여행 상세를 나간다', async ({ page }) => {
    const id = await createTrip(page, {
      title: '뒤로가기 확인',
      start: '2026-05-01',
      end: '2026-05-03',
      regions: ['강릉'],
    });

    // 목록에서 들어와야 나갈 곳이 생긴다.
    await page.goto('/trips');
    await page.getByTestId(`trip-card-${id}`).click();
    await expect(page.getByTestId('panel-days')).toBeVisible();

    await page.getByTestId('daytab-2').click();
    await expect(page).toHaveURL(/day=2026-05-02/);
    await page.getByTestId('daytab-3').click();
    await expect(page).toHaveURL(/day=2026-05-03/);

    // 날짜를 두 번 옮겼어도 한 번에 목록으로 나가야 한다.
    await page.goBack();
    await expect(page).toHaveURL(/\/trips$/);
  });

  test('상단 바의 뒤로 가기로 나간 뒤 제스처로 뒤로가도 상세로 돌아오지 않는다', async ({
    page,
  }) => {
    const id = await createTrip(page, {
      title: '뒤로 가기 버튼',
      start: '2026-05-01',
      end: '2026-05-02',
      regions: ['강릉'],
    });

    await page.goto('/trips');
    await page.getByTestId(`trip-card-${id}`).click();
    await expect(page.getByTestId('panel-days')).toBeVisible();

    // ‹ 는 들어온 길을 되짚는 자리다. 새 기록을 쌓으면 방문 기록이 계속 길어져
    // 제스처 뒤로가기가 방금 나온 화면으로 되돌아간다.
    const before = await page.evaluate(() => history.length);
    await page.getByLabel('뒤로').click();
    await expect(page).toHaveURL(/\/trips$/);
    expect(await page.evaluate(() => history.length)).toBe(before);
  });

  test('주소로 바로 들어왔으면 뒤로 가기가 지정된 화면으로 보낸다', async ({ page }) => {
    const id = await createTrip(page, {
      title: '직접 진입',
      start: '2026-05-01',
      end: '2026-05-02',
      regions: ['강릉'],
    });

    // 되짚을 기록이 없을 때 기록을 되감으면 앱 밖으로 나가 버린다.
    await page.goto(`/trips/${id}`);
    await expect(page.getByTestId('panel-days')).toBeVisible();

    await page.getByLabel('뒤로').click();
    await expect(page).toHaveURL(/\/trips$/);
  });
});
