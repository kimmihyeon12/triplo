import { expect, test } from '@playwright/test';
import { resetApp } from './helpers';

/**
 * 내 정보 화면과 그 하위 화면(공지·문의·약관)을 검증한다.
 *
 * 로그인·로그아웃·회원탈퇴는 auth.spec.ts가 맡는다. 여기서는 화면을 나눈
 * 뒤에 새로 생긴 것들만 본다.
 */

test.beforeEach(async ({ page }) => {
  await resetApp(page);
  // 공지·문의 저장소를 한 번만 비운다. addInitScript로 두면 페이지를 다시
  // 열 때마다 실행되어 방금 저장한 문의까지 지운다.
  // 문의는 계정마다 다른 열쇠(….support.<계정>)에 있으므로 앞머리로 찾아 지운다.
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage))
      if (key.startsWith('tc.test.trips.v1.support')) localStorage.removeItem(key);
  });
});

test('내 정보에서 닉네임을 그 자리에서 고친다', async ({ page }) => {
  // 저장 요청을 가로채 성공으로 답한다. 실제 서버 없이 흐름만 본다.
  await page.route('**/auth/v1/user*', async (route) => {
    const user = {
      id: 'trip-test-user',
      email: 'trips@example.com',
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: { provider: 'google' },
      user_metadata: { travel_nickname: '바다여행' },
    };
    await route.fulfill({ json: user });
  });

  await page.goto('/account');
  await expect(page.getByTestId('login-account')).toContainText('여행테스터');

  await page.getByTestId('nickname-edit').click();
  const input = page.getByTestId('nickname-input');
  await expect(input).toHaveValue('여행테스터');
  // 값이 그대로면 저장할 것이 없다.
  await expect(page.getByTestId('nickname-save')).toBeDisabled();

  await input.fill('바다여행');
  await expect(page.getByTestId('nickname-save')).toBeEnabled();
  await page.getByTestId('nickname-save').click();

  // 저장하면 편집이 닫히고 바뀐 이름이 보인다.
  await expect(page.getByTestId('nickname-input')).toHaveCount(0);
  await expect(page.getByTestId('login-account')).toContainText('바다여행');
});

test('닉네임이 너무 짧으면 저장할 수 없고 입력은 남는다', async ({ page }) => {
  await page.goto('/account');
  await page.getByTestId('nickname-edit').click();
  await page.getByTestId('nickname-input').fill('가');
  await expect(page.getByTestId('nickname-save')).toBeDisabled();
  await expect(page.getByTestId('nickname-input')).toHaveValue('가');
});

test('닉네임 편집을 취소하면 원래 이름이 남는다', async ({ page }) => {
  await page.goto('/account');
  await page.getByTestId('nickname-edit').click();
  await page.getByTestId('nickname-input').fill('버릴이름');
  await page.getByRole('button', { name: '취소' }).click();
  await expect(page.getByTestId('login-account')).toContainText('여행테스터');
});

// 감리 P2-02: 알림 기능이 없는데 스위치가 켜고 꺼지고, 새로고침하면 다시 켜졌다.
test('알림은 준비 중으로 꺼진 채 누를 수 없다', async ({ page }) => {
  await page.goto('/account');
  const toggle = page.getByTestId('toggle-notifications');
  await expect(toggle).toBeDisabled();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(toggle).toContainText('준비 중');
});

test('공지사항을 열면 목록이 보이고 첫 글이 펼쳐진다', async ({ page }) => {
  await page.goto('/account');
  // 읽기 전에는 새 소식 수가 보인다.
  await expect(page.getByTestId('go-notices')).toContainText('새 소식');

  await page.getByTestId('go-notices').click();
  await expect(page).toHaveURL(/\/account\/notices$/);
  const items = page.getByTestId('notice-list').locator('li');
  await expect(items).toHaveCount(3);
  // 목록은 본문을 두 줄까지 미리 보이고, 누르면 화면을 옮기지 않고 그 자리에서 전부 펼친다.
  const preview = items.first().getByTestId('notice-preview');
  const closed = await preview.evaluate((el) => el.getBoundingClientRect().height);
  await items.first().locator('summary').click();
  await expect(page).toHaveURL(/\/account\/notices$/);
  await expect(items.first().locator('details')).toHaveAttribute('open', '');
  await expect.poll(() => preview.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(closed);

  // 목록을 열었으면 읽은 것으로 본다.
  await page.goto('/account');
  await expect(page.getByTestId('go-notices')).not.toContainText('새 소식');
});

test('문의 목록이 먼저 보이고 보내기는 따로 연다', async ({ page }) => {
  await page.goto('/account/inquiries');
  // 보낸 것이 없으면 빈 화면이고 입력란은 없다.
  await expect(page.getByTestId('empty-inquiries')).toBeVisible();
  await expect(page.getByTestId('inquiry-body')).toHaveCount(0);

  await page.getByTestId('new-inquiry').click();
  await expect(page).toHaveURL(/\/account\/inquiries\/new$/);
  // 내용이 없으면 보낼 수 없다.
  await expect(page.getByTestId('inquiry-send')).toBeDisabled();

  await page.getByTestId('kind-idea').click();
  await page.getByTestId('inquiry-body').fill('가계부에 카테고리를 더 넣어주세요');
  await expect(page.getByTestId('inquiry-send')).toBeEnabled();
  await page.getByTestId('inquiry-send').click();

  // 보내면 목록으로 돌아가 방금 보낸 것이 맨 위에 있다.
  await expect(page).toHaveURL(/\/account\/inquiries$/);
  const list = page.getByTestId('inquiry-list').locator('li');
  await expect(list).toHaveCount(1);
  await expect(list.first()).toContainText('기능 제안');
  // 서버에 연결되기 전에는 접수된 것처럼 보이지 않는다(감리 P2-01).
  await expect(list.first()).toContainText('기기에만 저장');
  await expect(list.first()).not.toContainText('접수됨');
  // 펼쳐도 문의 내용은 한 번만 보인다.
  await list.first().locator('summary').click();
  await expect(list.first().getByText('가계부에 카테고리를 더 넣어주세요')).toHaveCount(1);
});

test('보낸 문의는 새로 열어도 남아 있다', async ({ page }) => {
  await page.goto('/account/inquiries/new');
  await page.getByTestId('inquiry-body').fill('지도에 장소가 안 보여요');
  await page.getByTestId('inquiry-send').click();
  await expect(page.getByTestId('inquiry-list').locator('li')).toHaveCount(1);

  await page.reload();
  await expect(page.getByTestId('inquiry-list').locator('li')).toContainText(
    '지도에 장소가 안 보여요',
  );
});

test('개인정보 처리방침과 이용약관은 서로 다른 글을 보여준다', async ({ page }) => {
  await page.goto('/account');
  await page.getByTestId('go-privacy').click();
  await expect(page).toHaveURL(/\/account\/privacy$/);
  await expect(page.getByRole('heading', { name: '개인정보 처리방침' })).toBeVisible();
  await expect(page.locator('article')).toContainText('AI에 무엇을 보내나요');

  await page.goto('/account/terms');
  await expect(page.getByRole('heading', { name: '이용약관' })).toBeVisible();
  await expect(page.locator('article')).toContainText('장소 정보에 관하여');
});

test('내 정보 화면 아래에 배포 버전이 보인다', async ({ page }) => {
  await page.goto('/account');
  await expect(page.getByTestId('app-version')).toContainText('버전');
});
