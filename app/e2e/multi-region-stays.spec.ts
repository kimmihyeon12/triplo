import { expect, test } from '@playwright/test';
import { addStay, addStop, createTrip, resetApp } from './helpers';

test.describe('3박 4일 두 지역·두 숙소', () => {
  test.beforeEach(async ({ page }) => resetApp(page));

  test('강릉 A 2박 + 속초 B 1박, 3일차 지역 이동과 숙소 변경 표시', async ({ page }) => {
    const id = await createTrip(page, { title: '강릉 속초', start: '2026-05-01', end: '2026-05-04', regions: ['강릉', '속초'] });
    await expect(page.getByTestId('trip-period')).toContainText('3박 4일');
    await expect(page.getByTestId('trip-regions')).toContainText('강릉');
    await expect(page.getByTestId('trip-regions')).toContainText('속초');

    await addStay(page, id, { name: 'A 숙소', checkIn: '2026-05-01', checkOut: '2026-05-03', region: '강릉' });
    await addStay(page, id, { name: 'B 숙소', checkIn: '2026-05-03', checkOut: '2026-05-04', region: '속초' });
    await expect(page.getByTestId('night-1')).toContainText('A 숙소');
    await expect(page.getByTestId('night-2')).toContainText('A 숙소 (연박)');
    await expect(page.getByTestId('night-3')).toContainText('B 숙소');
    await expect(page.getByTestId('stay-warnings')).toHaveCount(0);

    await addStop(page, id, { name: '강릉 카페', date: '2026-05-03', region: '강릉', stayMinutes: 60 });
    await addStop(page, id, { name: '점심', kind: 'meal', date: '2026-05-03', stayMinutes: 60 });
    await addStop(page, id, { name: '속초 중앙시장', date: '2026-05-03', region: '속초', stayMinutes: 90 });

    const day3 = page.getByTestId('day-2026-05-03');
    await expect(day3.getByTestId('day-stay-info')).toContainText('A 숙소 체크아웃');
    await expect(day3.getByTestId('day-stay-info')).toContainText('B 숙소 체크인');
    await expect(day3.getByText('강릉 → 속초 이동 · 시간 미확인')).toHaveCount(1);
    await expect(day3.getByTestId('day-totals')).toContainText('체류 3시간 30분');
    await expect(day3.getByTestId('day-totals')).toContainText('이동 2구간');

    await page.getByTestId('tab-overview').click();
    await expect(page.getByTestId('overview-night-3')).toContainText('A 숙소 체크아웃 → B 숙소 체크인');
    await expect(page.getByTestId('overview-day-3')).toContainText('지역 이동 1회');
    await expect(page.getByTestId('overview-night-4')).toContainText('귀가일');
  });
});
