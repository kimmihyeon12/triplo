import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, resetApp } from './helpers';

/** 목표 요소에 포커스가 닿을 때까지 Tab을 누른다(최대 6회). */
async function tabUntil(page: import('@playwright/test').Page, testId: string, max = 6): Promise<void> {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const focused = await page.getByTestId(testId).evaluate((el) => el === document.activeElement);
    if (focused) return;
  }
  await expect(page.getByTestId(testId)).toBeFocused();
}

test.describe('키보드만으로 첫 흐름, 가로 스크롤 없음', () => {
  test.beforeEach(async ({ page }) => resetApp(page));

  test('Tab·Enter·화살표만으로 여행 생성과 장소 추가, 날짜 탭 이동', async ({ page }) => {
    // 목록 → 새 여행 (링크에 포커스 후 Enter)
    await page.getByTestId('new-trip').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/trips\/new$/);

    await page.getByTestId('trip-title').focus();
    await page.keyboard.type('키보드 여행');
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('trip-start')).toBeFocused();
    // 브라우저 기본 date 입력은 chrome-headless-shell에서 키보드 타이핑을 받지 않는다(브라우저 한계).
    // 날짜 값만 fill로 넣고, 그 외 모든 조작은 키보드로 수행한다.
    await page.getByTestId('trip-start').fill('2026-05-01');
    await page.getByTestId('trip-end').fill('2026-05-02');
    await expect(page.getByTestId('nights')).toHaveText('1박 2일');
    // date 입력 안의 연·월·일 세그먼트를 Tab으로 지나 다음 필드에 도달한다.
    await page.getByTestId('trip-end').focus();
    await tabUntil(page, 'region-input');
    await page.keyboard.type('강릉');
    await page.keyboard.press('Enter'); // 지역 추가
    await expect(page.getByTestId('region-list')).toContainText('강릉');
    await page.getByTestId('trip-save').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('trip-title')).toHaveText('키보드 여행');
    await expectNoHorizontalScroll(page);

    await page.getByTestId('add-stop').focus();
    await page.keyboard.press('Enter');
    await page.getByTestId('stop-name').focus();
    await page.keyboard.type('안목해변');
    await page.getByTestId('stop-date').focus();
    await page.keyboard.press('ArrowDown'); // 미배치 → 1일차
    await page.getByTestId('stop-save').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('day-items')).toContainText('안목해변');
    await expectNoHorizontalScroll(page);

    // 날짜 탭 화살표 이동
    await page.getByTestId('daytab-1').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('daytab-2')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('daytab-2')).toBeFocused();
    await expect(page.getByTestId('empty-day')).toBeVisible();

    await page.getByTestId('tab-stays').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('panel-stays')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
