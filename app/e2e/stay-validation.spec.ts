import { expect, test } from '@playwright/test';
import { addStay, createTrip, resetApp } from './helpers';

test.describe('숙박 오류·중복·기간 밖', () => {
  test.beforeEach(async ({ page }) => resetApp(page));

  test('체크아웃이 체크인과 같거나 이전이면 저장이 차단된다', async ({ page }) => {
    const id = await createTrip(page, { start: '2026-05-01', end: '2026-05-04' });
    await page.goto(`/trips/${id}/stays/new`);
    await page.getByTestId('stay-name').fill('A');
    await page.getByTestId('stay-checkin').fill('2026-05-02');
    await page.getByTestId('stay-checkout').fill('2026-05-02');
    await expect(page.getByTestId('stay-date-error')).toContainText('체크아웃 날짜는 체크인 다음 날 이후');
    await expect(page.getByTestId('stay-save')).toBeDisabled();
    await page.getByTestId('stay-checkout').fill('2026-05-01');
    await expect(page.getByTestId('stay-save')).toBeDisabled();
    await page.getByTestId('stay-checkout').fill('2026-05-03');
    await expect(page.getByTestId('stay-nights')).toHaveText('1박');
    await expect(page.getByTestId('stay-save')).toBeEnabled();
  });

  test('중복 숙박은 확인 후 저장되고 두 카드에 중복 배지가 붙는다', async ({ page }) => {
    const id = await createTrip(page, { start: '2026-05-01', end: '2026-05-05' });
    await addStay(page, id, { name: 'A 숙소', checkIn: '2026-05-01', checkOut: '2026-05-03' });
    await page.goto(`/trips/${id}/stays/new`);
    await page.getByTestId('stay-name').fill('C 숙소');
    await page.getByTestId('stay-checkin').fill('2026-05-02');
    await page.getByTestId('stay-checkout').fill('2026-05-04');
    await expect(page.getByTestId('stay-warnings')).toContainText('5/2 밤이 겹칩니다');
    await expect(page.getByTestId('stay-save')).toBeDisabled();
    await page.getByTestId('stay-warning-confirm').check();
    await page.getByTestId('stay-save').click();
    await expect(page.getByTestId('night-2')).toHaveAttribute('data-state', 'conflict');
    const badges = page.getByTestId('stay-list').getByText('다른 숙박과 중복');
    await expect(badges).toHaveCount(2);
  });

  test('여행 기간 밖 숙박은 확인 후 저장되고 기간 밖 배지가 붙는다', async ({ page }) => {
    const id = await createTrip(page, { start: '2026-05-01', end: '2026-05-02' });
    await page.goto(`/trips/${id}/stays/new`);
    await page.getByTestId('stay-name').fill('밖 숙소');
    await page.getByTestId('stay-checkin').fill('2026-05-02');
    await page.getByTestId('stay-checkout').fill('2026-05-03');
    await expect(page.getByTestId('stay-warnings')).toContainText('여행 기간(5/1–5/2) 밖');
    await page.getByTestId('stay-warning-confirm').check();
    await page.getByTestId('stay-save').click();
    await expect(page.getByTestId('stay-list')).toContainText('여행 기간 밖');
    await expect(page.getByTestId('night-1')).toHaveAttribute('data-state', 'undecided');
  });
});
