import { expect, test } from '@playwright/test';
import { createTrip, resetApp } from './helpers';

test.describe('친구 초대', () => {
  test.beforeEach(async ({ page }) => resetApp(page));

  test('주인은 초대 링크를 만들어 복사하고, 새로 만들거나 취소한다', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const id = await createTrip(page, {
      title: '초대 여행',
      start: '2026-05-01',
      end: '2026-05-02',
      regions: ['강릉시'],
    });
    await page.goto(`/trips/${id}/invite`);
    await expect(page.getByTestId('member-list')).toContainText('여행을 만든 사람');

    await page.getByTestId('invite-create').click();
    await expect(page.getByTestId('invite-link')).toContainText('/join/TEST-CODE');
    await page.getByTestId('invite-copy').click();
    await expect(page.getByTestId('success-toast')).toContainText('초대 링크를 복사했어요');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('/join/TEST-CODE');

    await page.getByTestId('invite-renew').click();
    await expect(page.getByTestId('invite-link')).toContainText('/join/TEST-CODE');
    await page.getByTestId('invite-revoke').click();
    await expect(page.getByTestId('info-toast')).toContainText('초대 링크를 취소했어요');
    await expect(page.getByTestId('invite-create')).toBeVisible();
  });
});
