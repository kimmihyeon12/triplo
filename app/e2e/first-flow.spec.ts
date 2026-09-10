import { expect, test } from '@playwright/test';
import { addStay, addStop, createTrip, expectNoHorizontalScroll, resetApp } from './helpers';

test.describe('첫 흐름: 여행 생성 → 장소 1개 → 숙소 1개 → 보기 → 재열기', () => {
  test.beforeEach(async ({ page }) => resetApp(page));

  test('전체·날짜별·숙소 보기와 새로고침 후 재열기', async ({ page }) => {
    const id = await createTrip(page, { title: '강릉 주말', start: '2026-05-01', end: '2026-05-03', regions: ['강릉'] });
    await expect(page.getByTestId('trip-title')).toHaveText('강릉 주말');
    await expect(page.getByTestId('trip-period')).toContainText('2박 3일');
    await expect(page.getByTestId('empty-trip')).toBeVisible();
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved');

    await addStop(page, id, { name: '안목해변', date: '2026-05-01', region: '강릉', address: '강원 강릉시 창해로 14번길', stayMinutes: 60 });
    await expect(page.getByTestId('panel-days')).toBeVisible();
    await expect(page.getByTestId('day-items')).toContainText('안목해변');
    await expect(page.getByTestId('day-items')).toContainText('위치 미확인');
    await expect(page.getByTestId('day-totals')).toContainText('체류 1시간');
    await expect(page.getByTestId('day-stay-info')).toContainText('숙소 미정');

    await addStay(page, id, { name: 'A 호텔', checkIn: '2026-05-01', checkOut: '2026-05-03', region: '강릉' });
    await expect(page.getByTestId('panel-stays')).toBeVisible();
    await expect(page.getByTestId('night-1')).toHaveAttribute('data-state', 'covered');
    await expect(page.getByTestId('night-2')).toContainText('연박');
    await expect(page.getByTestId('stay-list')).toContainText('2박');

    await page.getByTestId('tab-overview').click();
    await expect(page.getByTestId('overview-day-1')).toContainText('안목해변');
    await expect(page.getByTestId('overview-night-1')).toContainText('A 호텔 체크인');
    await expect(page.getByTestId('overview-night-2')).toContainText('A 호텔 연박');
    await expect(page.getByTestId('overview-night-3')).toContainText('귀가일');

    await page.getByTestId('tab-days').click();
    await expect(page.getByTestId('day-stay-info')).toContainText('A 호텔 체크인');
    await expectNoHorizontalScroll(page);

    // 재열기: 새로고침 후 같은 내용, 목록에서 다시 열기
    await page.reload();
    await expect(page.getByTestId('trip-title')).toHaveText('강릉 주말');
    await expect(page.getByTestId('day-items')).toContainText('안목해변');
    await page.goto('/trips');
    await expect(page.getByTestId(`trip-card-${id}`)).toContainText('장소 1');
    await expect(page.getByTestId(`trip-card-${id}`)).toContainText('숙소 1');
    await page.getByTestId(`trip-card-${id}`).click();
    await expect(page.getByTestId('trip-title')).toHaveText('강릉 주말');
  });

  test('장소 이름 없이 저장할 수 없고 체류시간 오류를 표시한다', async ({ page }) => {
    const id = await createTrip(page, { start: '2026-05-01', end: '2026-05-01' });
    await page.goto(`/trips/${id}/stops/new`);
    await expect(page.getByTestId('stop-save')).toBeDisabled();
    await page.getByTestId('stop-name').fill('카페');
    await page.getByTestId('stop-stay').fill('-5');
    await expect(page.getByText('0 이상의 분 단위로 입력하세요.')).toBeVisible();
    await expect(page.getByTestId('stop-save')).toBeDisabled();
    await page.getByTestId('stop-stay').fill('30');
    await expect(page.getByTestId('stop-save')).toBeEnabled();
  });
});
