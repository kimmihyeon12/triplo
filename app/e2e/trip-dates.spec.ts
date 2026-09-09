import { expect, test } from '@playwright/test';
import { addStop, createTrip, resetApp } from './helpers';

test.describe('여행 날짜: 당일, 날짜 미정 → 확정, 날짜 오류', () => {
  test.beforeEach(async ({ page }) => resetApp(page));

  test('당일 여행은 0박 1일이며 숙박이 없다', async ({ page }) => {
    await createTrip(page, { title: '서울 하루', start: '2026-05-01', end: '2026-05-01' });
    await expect(page.getByTestId('trip-period')).toContainText('0박 1일');
    await page.getByTestId('tab-stays').click();
    await expect(page.getByTestId('no-nights')).toBeVisible();
  });

  test('종료일이 시작일보다 빠르면 저장할 수 없다', async ({ page }) => {
    await page.goto('/trips/new');
    await page.getByTestId('trip-start').fill('2026-05-05');
    await page.getByTestId('trip-end').fill('2026-05-01');
    await expect(page.getByTestId('date-error')).toContainText('종료일');
    await expect(page.getByTestId('trip-save')).toBeDisabled();
    await page.getByTestId('trip-end').fill('');
    await expect(page.getByTestId('date-error')).toContainText('모두');
  });

  test('날짜 미정 초안에 장소를 담고 날짜를 정하면 미배치가 유지되고 날짜별 탭이 열린다', async ({ page }) => {
    const id = await createTrip(page, { title: '어딘가', regions: ['부산'] });
    await expect(page.getByTestId('trip-period')).toHaveText('날짜 미정');
    await addStop(page, id, { name: '해운대' });
    await addStop(page, id, { name: '광안리' });
    await expect(page.getByTestId('unassigned')).toContainText('해운대');
    await expect(page.getByTestId('unassigned')).toContainText('광안리');
    await page.getByTestId('tab-days').click();
    await expect(page.getByText('날짜를 정하면 날짜별 일정을 만들 수 있습니다.')).toBeVisible();

    await page.getByTestId('trip-edit').click();
    await page.getByTestId('trip-start').fill('2026-06-01');
    await page.getByTestId('trip-end').fill('2026-06-02');
    await expect(page.getByTestId('impact-box')).toHaveCount(0);
    await page.getByTestId('trip-save').click();
    await expect(page.getByTestId('trip-period')).toContainText('1박 2일');
    await expect(page.getByTestId('unassigned')).toContainText('해운대');
    await page.getByTestId('tab-days').click();
    await expect(page.getByTestId('daytab-1')).toBeVisible();
    await expect(page.getByTestId('empty-day')).toBeVisible();

    // 미배치 장소를 날짜에 배치
    await page.getByTestId('tab-overview').click();
    await page.getByTestId('unassigned').getByRole('link', { name: '날짜 배치' }).first().click();
    await page.getByTestId('stop-date').selectOption('2026-06-02');
    await page.getByTestId('stop-save').click();
    await expect(page.getByTestId('day-2026-06-02')).toContainText('해운대');
  });
});
