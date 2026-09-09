import { expect, test } from '@playwright/test';
import { addStay, addStop, createTrip, resetApp } from './helpers';

test.describe('기간 단축 데이터 보존, 순서 변경·제외·합계', () => {
  test.beforeEach(async ({ page }) => resetApp(page));

  test('기간 단축 시 영향 확인 후 장소는 미배치로, 숙소는 기간 밖으로 보존된다', async ({ page }) => {
    const id = await createTrip(page, { start: '2026-05-01', end: '2026-05-04', regions: ['강릉', '속초'] });
    await addStop(page, id, { name: '1일차 장소', date: '2026-05-01', region: '강릉' });
    await addStop(page, id, { name: '3일차 장소', date: '2026-05-03', region: '속초' });
    await addStop(page, id, { name: '4일차 장소', date: '2026-05-04', region: '속초' });
    await addStay(page, id, { name: 'B 숙소', checkIn: '2026-05-03', checkOut: '2026-05-04', region: '속초' });

    await page.getByTestId('trip-edit').click();
    await page.getByTestId('trip-end').fill('2026-05-02');
    await expect(page.getByTestId('impact-box')).toContainText('장소 2개가 새 기간 밖에 있어 미배치로 이동');
    await expect(page.getByTestId('impact-box')).toContainText('숙소 1개가 여행 기간 밖이 됩니다(보존됨)');
    await expect(page.getByTestId('trip-save')).toBeDisabled();
    // 지역 삭제 영향도 같은 상자에 표시
    await page.getByRole('button', { name: '속초 삭제' }).click();
    await expect(page.getByTestId('impact-box')).toContainText('지역 ‘속초’ 삭제: 장소 2개·숙소 1개');
    await page.getByTestId('impact-confirm').check();
    await page.getByTestId('trip-save').click();

    await expect(page.getByTestId('trip-period')).toContainText('1박 2일');
    await expect(page.getByTestId('unassigned')).toContainText('3일차 장소');
    await expect(page.getByTestId('unassigned')).toContainText('4일차 장소');
    await expect(page.getByTestId('overview-day-1')).toContainText('1일차 장소');
    await page.getByTestId('tab-stays').click();
    await expect(page.getByTestId('stay-list')).toContainText('B 숙소');
    await expect(page.getByTestId('stay-list')).toContainText('여행 기간 밖');

    await page.reload();
    await expect(page.getByTestId('stay-list')).toContainText('B 숙소');
  });

  test('위·아래 이동, 제외 시 합계 감소, 고정 시각 충돌 표시', async ({ page }) => {
    const id = await createTrip(page, { start: '2026-05-01', end: '2026-05-01' });
    await addStop(page, id, { name: '첫째', date: '2026-05-01', stayMinutes: 30, fixedTime: '13:00' });
    await addStop(page, id, { name: '둘째', date: '2026-05-01', stayMinutes: 45, fixedTime: '11:00' });
    await addStop(page, id, { name: '셋째', date: '2026-05-01', stayMinutes: 15 });

    const items = page.getByTestId('day-items').locator('li.item strong');
    await expect(items).toHaveText(['첫째', '둘째', '셋째']);
    await expect(page.getByTestId('day-totals')).toContainText('체류 1시간 30분');
    await expect(page.getByTestId('fixed-conflict')).toBeVisible();

    await page.getByRole('button', { name: '둘째 위로' }).click();
    await expect(items).toHaveText(['둘째', '첫째', '셋째']);
    await expect(page.getByTestId('fixed-conflict')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '둘째 위로' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '셋째 아래로' })).toBeDisabled();

    await page.getByRole('button', { name: '셋째 제외' }).click();
    await expect(page.getByTestId('day-totals')).toContainText('체류 1시간 15분');
    await expect(page.getByTestId('day-items')).toContainText('제외됨');
    await page.getByRole('button', { name: '셋째 복원' }).click();
    await expect(page.getByTestId('day-totals')).toContainText('체류 1시간 30분');

    await page.reload();
    await expect(items).toHaveText(['둘째', '첫째', '셋째']);
  });
});
