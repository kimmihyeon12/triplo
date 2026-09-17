import { expect, test } from '@playwright/test';
import { createTrip, resetApp } from './helpers';

/**
 * 정산 화면은 여행 기능의 라우트에서 다른 기능의 화면을 붙이는 자리다.
 * 그 연결이 끊기면 빈 화면이 되는데, 상세 화면 검사만으로는 드러나지 않는다.
 */
test.describe('정산 화면 진입', () => {
  test.beforeEach(async ({ page }) => resetApp(page));

  test('여행 상세에서 정산으로 들어가면 화면이 열린다', async ({ page }) => {
    const id = await createTrip(page, {
      title: '정산 확인',
      start: '2026-05-01',
      end: '2026-05-02',
      regions: ['강릉'],
    });

    await page.getByTestId('go-expenses').click();
    await expect(page).toHaveURL(new RegExp(`/trips/${id}/expenses`));
    await expect(page.getByTestId('panel-expenses')).toBeVisible();
  });

  test('주소로 바로 들어가도 화면이 열린다', async ({ page }) => {
    const id = await createTrip(page, {
      title: '정산 직접 진입',
      start: '2026-05-01',
      end: '2026-05-02',
      regions: ['강릉'],
    });

    await page.goto(`/trips/${id}/expenses`);
    await expect(page.getByTestId('panel-expenses')).toBeVisible();
  });

  test('정산 탭을 왕복해도 작성 중인 지출 입력을 보존한다', async ({ page }) => {
    const id = await createTrip(page, {
      title: '입력 보존',
      start: '2026-05-01',
      end: '2026-05-02',
      regions: ['강릉'],
    });

    await page.goto(`/trips/${id}/expenses`);
    await page.getByTestId('add-expense').click();
    await page.getByLabel('지출명', { exact: true }).fill('첫날 저녁');
    await page.getByLabel('실제 금액 (원)', { exact: true }).fill('12345');
    await page.getByRole('tab', { name: '정산 현황' }).click();
    await page.getByRole('tab', { name: '지출 내역' }).click();

    await expect(page.getByLabel('지출명', { exact: true })).toHaveValue('첫날 저녁');
    await expect(page.getByLabel('실제 금액 (원)', { exact: true })).toHaveValue('12345');
  });

  test('360px에서 지출 날짜와 분류 필드는 세로로 배치한다', async ({ page }) => {
    const id = await createTrip(page, {
      title: '좁은 화면',
      start: '2026-05-01',
      end: '2026-05-02',
      regions: ['강릉'],
    });

    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`/trips/${id}/expenses`);
    await page.getByTestId('add-expense').click();
    const date = page.getByLabel('지출 날짜', { exact: true });
    const category = page.getByLabel('분류', { exact: true });
    const [dateBox, categoryBox] = await Promise.all([date.boundingBox(), category.boundingBox()]);
    expect(dateBox).not.toBeNull();
    expect(categoryBox).not.toBeNull();
    expect(Math.abs(dateBox!.y - categoryBox!.y)).toBeGreaterThanOrEqual(40);
  });
});
