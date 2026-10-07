import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalScroll, resetApp } from './helpers';

/**
 * 관리자 메뉴와 /admin 진입을 검증한다. 관리자 여부는 서버 함수
 * is_admin의 응답을 가로채 정한다. 실제 서버 규칙은 SQL 검증이 맡는다.
 */

async function answerIsAdmin(page: Page, admin: boolean): Promise<void> {
  await page.route('**/rest/v1/rpc/is_admin', (route) => route.fulfill({ json: admin }));
}

test.beforeEach(async ({ page }) => {
  await resetApp(page);
});

test('관리자는 내 정보에서 관리자 화면으로 들어간다', async ({ page }) => {
  await answerIsAdmin(page, true);
  await page.goto('/account');
  await page.getByTestId('go-admin').click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByTestId('admin-home')).toBeVisible();
  await expect(page.getByTestId('admin-notices')).toHaveAttribute('href', '/admin/notices');
  await expect(page.getByTestId('admin-inquiries')).toHaveAttribute('href', '/admin/inquiries');
  await expectNoHorizontalScroll(page);
});

test('일반 사용자에게는 관리자 메뉴가 없다', async ({ page }) => {
  await answerIsAdmin(page, false);
  await page.goto('/account');
  await expect(page.getByTestId('go-notices')).toBeVisible();
  await expect(page.getByTestId('go-admin')).toHaveCount(0);
});

test('일반 사용자가 주소를 직접 입력하면 내 정보로 돌아간다', async ({ page }) => {
  await answerIsAdmin(page, false);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByTestId('admin-home')).toHaveCount(0);
});

test('관리자 여부를 확인하지 못하면 막는다', async ({ page }) => {
  await page.route('**/rest/v1/rpc/is_admin', (route) =>
    route.fulfill({ status: 500, json: { message: 'boom' } }),
  );
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByTestId('go-admin')).toHaveCount(0);
});

/** 관리자 공지·문의 서버를 흉내 낸다. 호출된 함수와 인자를 기록한다. 실제 권한은 SQL 검증이 맡는다. */
async function fakeAdminServer(page: Page) {
  const calls: { fn: string; body: unknown }[] = [];
  const notices = [{ id: 'n1', title: '점검 안내', body: '오늘 밤 점검', status: 'draft', generated: false, release_tag: '', created_at: '2026-10-01T00:00:00Z', published_at: null as string | null }];
  const inquiries = [{
    id: 'q1', user_id: 'u', sender_nickname: '민지', kind: 'bug', body: '지도가 안 떠요', status: 'open', app_version: 'v0.10.2',
    user_agent: 'test-agent', answer_read_at: null, created_at: '2026-10-01T00:00:00Z',
    inquiry_replies: [] as { id: string; body: string; author_role: string; created_at: string }[],
  }];
  await answerIsAdmin(page, true);
  await page.route('**/rest/v1/notices*', (route) => route.fulfill({ json: notices }));
  await page.route('**/rest/v1/inquiries*', (route) => route.fulfill({ json: inquiries }));
  await page.route('**/rest/v1/rpc/admin_*', async (route) => {
    const fn = route.request().url().split('/rpc/')[1]!.split('?')[0]!;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    calls.push({ fn, body });
    if (fn === 'admin_save_notice') notices[0]!.title = String(body['p_title']);
    if (fn === 'admin_set_notice_published') {
      notices[0]!.status = body['p_published'] ? 'published' : 'draft';
      notices[0]!.published_at = body['p_published'] ? '2026-10-01T02:00:00Z' : null;
    }
    if (fn === 'admin_reply_inquiry') {
      inquiries[0]!.status = 'answered';
      inquiries[0]!.inquiry_replies.push({ id: 'r1', body: String(body['p_body']), author_role: 'admin', created_at: '2026-10-01T01:00:00Z' });
    }
    await route.fulfill({ json: fn === 'admin_save_notice' ? 'n1' : null });
  });
  return calls;
}

test('관리자는 공지를 고쳐 발행하면 목록으로 돌아간다', async ({ page }) => {
  const calls = await fakeAdminServer(page);
  await page.goto('/admin');
  await page.getByTestId('admin-notices').click();
  await expect(page.getByTestId('admin-notice-list')).toContainText('초안');
  await page.getByTestId('admin-notice-n1').click();
  await expect(page.getByTestId('admin-notice-title')).toHaveValue('점검 안내');
  await page.getByTestId('admin-notice-title').fill('   ');
  await expect(page.getByTestId('admin-notice-save')).toBeDisabled();
  await page.getByTestId('admin-notice-title').fill('점검 안내(수정)');
  await page.getByTestId('admin-notice-published').check();
  await page.getByTestId('admin-notice-save').click();
  // 앱의 편집 폼처럼 저장하면 목록으로 돌아간다. 고친 내용을 먼저 저장하고 발행한다.
  await expect(page).toHaveURL(/\/admin\/notices$/);
  await expect(page.getByTestId('success-toast')).toContainText('발행했어요');
  await expect(page.getByTestId('admin-notice-list')).toContainText('발행됨');
  expect(calls.map((c) => c.fn)).toEqual(['admin_save_notice', 'admin_set_notice_published']);
  expect(calls[0]!.body).toMatchObject({ p_id: 'n1', p_title: '점검 안내(수정)' });
  // 뒤로 가도 방금 저장한 폼이 다시 나오지 않는다.
  await page.goBack();
  await expect(page).toHaveURL(/\/admin$/);
  await expectNoHorizontalScroll(page);
});

test('새 공지를 주소로 바로 열어 저장해도 뒤로 가면 폼이 다시 나오지 않는다', async ({ page }) => {
  await fakeAdminServer(page);
  await page.goto('/admin/notices/new');
  await page.getByTestId('admin-notice-title').fill('새 공지');
  await page.getByTestId('admin-notice-body').fill('본문');
  await page.getByTestId('admin-notice-save').click();
  await expect(page).toHaveURL(/\/admin\/notices$/);
  await expect(page.getByTestId('success-toast')).toContainText('저장했어요');
  await page.locator('.topbar__back').click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goBack();
  await expect(page.getByTestId('admin-notice-form')).toHaveCount(0);
});

test('새 공지는 상단 바 동작으로 쓰고, 비운 칸은 그 칸 아래에 알린다', async ({ page }) => {
  await fakeAdminServer(page);
  await page.goto('/admin/notices');
  await page.getByTestId('admin-notice-new').click();
  await expect(page).toHaveURL(/\/admin\/notices\/new$/);
  // 처음 열었을 때는 오류를 보이지 않는다.
  await expect(page.locator('#admin-notice-title-error')).toHaveCount(0);
  await page.getByTestId('admin-notice-title').focus();
  await page.getByTestId('admin-notice-body').focus();
  await expect(page.locator('#admin-notice-title-error')).toHaveText('제목을 입력해 주세요.');
  await expect(page.getByTestId('admin-notice-title')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByTestId('admin-notice-delete')).toHaveCount(0);
});

test('공지는 한 번 더 확인하고 지운다', async ({ page }) => {
  const calls = await fakeAdminServer(page);
  await page.goto('/admin/notices/n1');
  await page.getByTestId('admin-notice-delete').click();
  await expect(page.getByTestId('admin-notice-delete-confirm')).toBeVisible();
  expect(calls).toEqual([]);
  await page.getByTestId('admin-notice-delete-yes').click();
  await expect(page).toHaveURL(/\/admin\/notices$/);
  await expect(page.getByTestId('success-toast')).toContainText('공지를 지웠어요');
  expect(calls.map((c) => c.fn)).toEqual(['admin_delete_notice']);
});

test('관리자는 문의를 보고 답한다', async ({ page }) => {
  const calls = await fakeAdminServer(page);
  await page.goto('/admin/inquiries');
  await expect(page.getByTestId('admin-inquiry-q1')).toContainText('민지');
  await page.getByTestId('admin-inquiry-filter-answered').click();
  await expect(page.getByTestId('admin-inquiry-q1')).toHaveCount(0);
  await page.getByTestId('admin-inquiry-filter-all').click();
  await page.getByTestId('admin-inquiry-q1').click();
  await expect(page.getByTestId('admin-inquiry-device')).toContainText('v0.10.2');
  await expect(page.getByTestId('admin-reply-send')).toBeDisabled();
  await page.getByTestId('admin-reply-body').fill('확인했어요. 고칠게요.');
  await page.getByTestId('admin-reply-send').click();
  await expect(page.getByTestId('admin-inquiry-replies')).toContainText('확인했어요. 고칠게요.');
  await expect(page.getByTestId('admin-inquiry-status')).toContainText('답변 완료');
  expect(calls).toEqual([{ fn: 'admin_reply_inquiry', body: { p_id: 'q1', p_body: '확인했어요. 고칠게요.' } }]);
  await expectNoHorizontalScroll(page);
});

test('일반 사용자는 관리자 하위 화면에도 들어가지 못한다', async ({ page }) => {
  await answerIsAdmin(page, false);
  await page.goto('/admin/inquiries/q1');
  await expect(page).toHaveURL(/\/account$/);
});

test('관리자 권한이 사라지면 내 정보로 돌아간다', async ({ page }) => {
  await answerIsAdmin(page, true);
  await page.route('**/rest/v1/notices*', (route) =>
    route.fulfill({ status: 403, json: { code: '42501', message: 'admin_only', details: null, hint: null } }),
  );
  await page.goto('/admin/notices');
  await expect(page).toHaveURL(/\/account$/);
});

test('서버 함수가 관리자 권한을 거절하면 알리고 내 정보로 돌아간다', async ({ page }) => {
  await fakeAdminServer(page);
  await page.route('**/rest/v1/rpc/admin_save_notice', (route) =>
    route.fulfill({ status: 403, json: { code: '42501', message: 'admin_only', details: null, hint: null } }),
  );
  await page.goto('/admin/notices/n1');
  await page.getByTestId('admin-notice-title').fill('바꾼 제목');
  await page.getByTestId('admin-notice-save').click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByTestId('error-toast')).toContainText('관리자 권한이 없어요');
});

test('없는 공지를 열면 목록으로 돌아가며 알린다', async ({ page }) => {
  await fakeAdminServer(page);
  await page.goto('/admin/notices/missing');
  await expect(page).toHaveURL(/\/admin\/notices$/);
  await expect(page.getByTestId('error-toast')).toContainText('이미 지워진 공지예요');
});

test('관리자는 사용량 화면에서 무료 한도 대비 사용률과 이번 달 추정 비용을 본다', async ({ page }) => {
  await answerIsAdmin(page, true);
  await page.route('**/rest/v1/rpc/admin_usage_summary', (route) =>
    route.fulfill({
      json: {
        measuredAt: '2026-10-07T06:00:00+00:00',
        gemini: {
          dayStart: '2026-10-07T07:00:00+00:00',
          dayRequests: 420,
          dayFailed: 2,
          last24hRequests: 431,
          monthSince: '2026-09-30T15:00:00+00:00',
          month: [
            { kind: 'chat', model: 'gemini-3.5-flash-lite', requests: 1000, inputTokens: 400000, outputTokens: 300000 },
          ],
        },
        supabase: { dbBytes: 31457280, storageBytes: 0, activeUsers30d: 12 },
      },
    }),
  );
  await page.goto('/admin');
  await page.getByTestId('admin-usage').click();
  await expect(page).toHaveURL(/\/admin\/usage$/);
  const gemini = page.getByTestId('usage-meter-gemini-day');
  await expect(gemini).toContainText('420 / 500회 · 84%');
  await expect(gemini).toHaveAttribute('data-level', 'warn');
  await expect(gemini).toContainText('80% 넘음');
  // 하루 기준이 오후 4시에 바뀌어 0회로 보여도 실제 사용량을 알 수 있게 한다(2026-10-07 사용자 지적).
  await expect(page.getByTestId('usage-last24h')).toContainText('최근 24시간 431회');
  await expect(page.getByTestId('usage-meter-db')).toHaveAttribute('data-level', 'ok');
  await expect(page.getByTestId('usage-month')).toContainText('챗봇');
  await expect(page.getByTestId('usage-month-total')).toContainText('1,179원');
  // 10월 7일까지 1,179원, 활성 12명 → 1명당 월 435원. 100명이면 Gemini 43,505원, Supabase Pro를 더해 77,380원.
  const row100 = page.getByTestId('usage-scenarios').getByRole('row', { name: /^100명/ });
  await expect(row100).toContainText('43,505원');
  await expect(row100).toContainText('77,380원');
  await expect(row100).toContainText('774원');
  await expectNoHorizontalScroll(page);
});

test('사용량을 불러오지 못하면 숫자를 지어내지 않고 알린다', async ({ page }) => {
  await answerIsAdmin(page, true);
  await page.route('**/rest/v1/rpc/admin_usage_summary', (route) => route.fulfill({ json: { broken: true } }));
  await page.goto('/admin/usage');
  await expect(page.getByTestId('admin-usage-error')).toBeVisible();
});
