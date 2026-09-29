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

  test('초대 링크를 열면 일정을 미리 보고 함께하기로 여행에 들어간다', async ({ page }) => {
    const id = await createTrip(page, {
      title: '같이 갈 여행',
      start: '2026-05-01',
      end: '2026-05-02',
      regions: ['강릉시'],
    });
    await page.goto('/join/test-code');
    await expect(page.getByTestId('join-page')).toContainText('같이 갈 여행');
    await expect(page.getByTestId('join-page')).toContainText('보기만 할 수 있어요');
    await page.getByTestId('join-accept').click();
    await expect(page).toHaveURL(new RegExp(`/trips/${id}$`));
    await expect(page.getByTestId('success-toast')).toContainText('여행에 함께하게 됐어요');
  });

  test('잘못된 초대 링크는 한 가지 안내만 보인다', async ({ page }) => {
    await createTrip(page, { title: '비밀 여행', start: '2026-05-01', end: '2026-05-02', regions: ['강릉시'] });
    await page.goto('/join/AAAA-BBBB');
    await expect(page.getByTestId('join-invalid')).toContainText('초대 링크가 올바르지 않거나 만료됐어요');
    await expect(page.getByText('비밀 여행')).toHaveCount(0);
  });
});
