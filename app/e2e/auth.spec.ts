import { expect, test } from '@playwright/test';

function sessionFor(user: object, expiresAt = Math.floor(Date.now() / 1000) + 3600) {
  return {
    user,
    access_token: `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: expiresAt })).toString('base64url')}.sig`,
    refresh_token: 'test-refresh',
    token_type: 'bearer',
    expires_at: expiresAt,
  };
}

const authUrl = 'https://auth.test.supabase.co';
const user = {
  id: 'c0c0c0c0-1111-4111-8111-111111111111',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'tester@example.com',
  app_metadata: { provider: 'google' },
  user_metadata: { travel_nickname: '여행테스터' },
  created_at: '2026-09-14T00:00:00Z',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/supabase-config.test.json', (route) =>
    route.fulfill({ json: { url: authUrl, publishableKey: 'sb_publishable_test-only' } }),
  );
});

for (const logoutFails of [false, true])
  test(`Google 로그인·복원·로그아웃 (서버 해제 실패: ${logoutFails})`, async ({ page }) => {
    let exchanged = false;
    await page.route(`${authUrl}/auth/v1/**`, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/authorize')) {
        expect(url.searchParams.get('provider')).toBe('google');
        expect(url.searchParams.get('code_challenge')).toBeTruthy();
        const callback = url.searchParams.get('redirect_to')!;
        expect(callback).toBe('http://localhost:4300/auth/callback');
        await route.fulfill({ status: 302, headers: { location: callback + '?code=test-code' } });
      } else if (url.pathname.endsWith('/token')) {
        expect(route.request().postDataJSON().auth_code).toBe('test-code');
        expect(route.request().postDataJSON().code_verifier).toBeTruthy();
        exchanged = true;
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const jwt = [
          Buffer.from('{}').toString('base64url'),
          Buffer.from(JSON.stringify({ sub: user.id, exp })).toString('base64url'),
          'signature',
        ].join('.');
        await route.fulfill({
          json: {
            access_token: jwt,
            refresh_token: 'test-refresh',
            token_type: 'bearer',
            expires_in: 3600,
            user,
          },
        });
      } else if (url.pathname.endsWith('/logout')) {
        await new Promise((resolve) => setTimeout(resolve, 600));
        await route.fulfill(
          logoutFails ? { status: 400, json: { msg: 'Logout unavailable' } } : { status: 204 },
        );
      } else if (url.pathname.endsWith('/user')) await route.fulfill({ json: user });
      else throw new Error(`Unexpected auth request: ${url.pathname}`);
    });
    await page.goto('/login');
    await page.getByTestId('login-google').click();
    await expect(page).toHaveURL('http://localhost:4300/trips');
    await page.getByRole('link', { name: '내 정보', exact: true }).click();
    await expect(page.getByTestId('login-account')).toContainText(user.email);
    expect(exchanged).toBe(true);
    await expect(page).toHaveURL('http://localhost:4300/account');
    await expect(page.getByTestId('login-storage-notice')).toContainText('이 기기에');
    await page.reload();
    await expect(page.getByTestId('login-account')).toContainText(user.email);
    await page.getByTestId('logout').click();
    await expect(page.getByTestId('logout').locator('.loading-spinner')).toBeVisible();
    await expect(page.getByTestId('logout')).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByTestId('logout')).toBeDisabled();
    await expect(page.getByTestId('login-google')).toBeEnabled();
    await expect(page.getByTestId('login-account')).toHaveCount(0);
    await expect(page).toHaveURL('http://localhost:4300/login');
    if (logoutFails) await expect(page.getByRole('alert')).toContainText('이 기기에서는 로그아웃');
  });

for (const provider of ['google', 'kakao'])
  test(`${provider} 첫 가입은 소셜 인증 후 닉네임만 입력`, async ({ page }) => {
    await page.route('**/supabase-config.test.json', (route) =>
      route.fulfill({
        json: { url: authUrl, publishableKey: 'sb_publishable_test-only', kakaoLoginEnabled: true },
      }),
    );
    const firstUser = {
      ...user,
      app_metadata: { provider },
      user_metadata: { full_name: 'Provider Name' },
    };
    await page.route(`${authUrl}/auth/v1/**`, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/authorize')) {
        expect(url.searchParams.get('provider')).toBe(provider);
        expect(url.searchParams.get('scope')).toBe(
          provider === 'kakao' ? 'profile_nickname' : null,
        );
        // 로그아웃한 뒤 다른 계정으로 들어올 수 있게 늘 계정 선택을 띄운다.
        expect(url.searchParams.get('prompt')).toBe('select_account');
        await route.fulfill({
          status: 302,
          headers: { location: url.searchParams.get('redirect_to')! + '?code=new-code' },
        });
      } else if (url.pathname.endsWith('/token')) {
        expect(route.request().postDataJSON().code_verifier).toBeTruthy();
        await route.fulfill({ json: { ...sessionFor(firstUser), expires_in: 3600 } });
      } else if (url.pathname.endsWith('/user')) {
        expect(route.request().method()).toBe('PUT');
        expect(route.request().postDataJSON().data).toEqual({ travel_nickname: '여행친구' });
        await new Promise((resolve) => setTimeout(resolve, 400));
        await route.fulfill({
          json: { ...firstUser, user_metadata: { travel_nickname: '여행친구' } },
        });
      } else throw new Error(`Unexpected auth request: ${url.pathname}`);
    });
    await page.goto('/login');
    await page.getByTestId(`login-${provider}`).click();
    await expect(page).toHaveURL('http://localhost:4300/onboarding');
    await expect(page.locator('input')).toHaveCount(1);
    await page.getByLabel('닉네임', { exact: true }).fill('여행친구');
    await page.getByRole('button', { name: '시작하기' }).click();
    await expect(page.getByRole('button', { name: '시작하기' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    // 처음 가입한 사람은 구름이가 안내하는 사용법을 먼저 본다(2026-10-01).
    await expect(page).toHaveURL('http://localhost:4300/account/guide?first=1');
  });

test('인증 취소를 설명하고 URL의 오류 정보를 제거한 뒤 재시도 가능', async ({ page }) => {
  await page.goto('/auth/callback?error=access_denied&error_description=private-detail');
  await expect(page.getByRole('alert')).toContainText('취소');
  await expect(page).toHaveURL('http://localhost:4300/auth/callback');
  await expect(page.getByTestId('login-google')).toBeEnabled();
  await expect(page.locator('body')).not.toContainText('private-detail');
  await page.getByRole('button', { name: '오류 알림 닫기' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByTestId('login-google')).toBeEnabled();
});

test('키가 없을 때 로그인 사용 불가 안내와 여행 접근 차단', async ({ page }) => {
  await page.route('**/supabase-config.test.json', (route) => route.fulfill({ status: 404 }));
  await page.goto('/login');
  await expect(page.getByRole('alert')).toContainText('설정');
  await expect(page.getByTestId('login-google')).toBeDisabled();
  await expect(page.getByRole('link', { name: '여행으로 돌아가기' })).toHaveCount(0);
});

test('인증 코드 교환 실패를 표시하고 계정을 로그인 상태로 표시하지 않음', async ({ page }) => {
  let tokenRequested = false;
  await page.addInitScript(() =>
    localStorage.setItem('tc.test.auth.v1-code-verifier', JSON.stringify('test-verifier')),
  );
  await page.route(`${authUrl}/auth/v1/token**`, (route) => {
    tokenRequested = true;
    return route.fulfill({
      status: 400,
      json: { error: 'invalid_grant', error_description: 'Expired code' },
    });
  });
  await page.goto('/auth/callback?code=expired');
  await expect(page.getByRole('alert')).toContainText('다시');
  await expect(page.getByTestId('login-account')).toHaveCount(0);
  await expect(page.getByTestId('login-google')).toBeEnabled();
  expect(tokenRequested).toBe(true);
});

test('Google 화면에서 돌아왔을 때 다시 로그인 가능', async ({ page }) => {
  await page.route(`${authUrl}/auth/v1/authorize**`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<title>Test OAuth provider</title><p>Choose account</p>',
    }),
  );
  await page.goto('/login');
  await page.getByTestId('login-google').click();
  await page.waitForURL(`${authUrl}/auth/v1/authorize**`);
  await page.goBack();
  await expect(page.getByTestId('login-google')).toBeEnabled();
});

test('로그인하지 않은 사용자의 내 정보 직접 접근은 로그인으로 이동', async ({ page }) => {
  await page.goto('/account');
  await expect(page).toHaveURL('http://localhost:4300/login');
  await expect(page.getByTestId('login-google')).toBeEnabled();
  await expect(page.getByTestId('login-account')).toHaveCount(0);
});

// 감리 P2-03: 로그인 화면은 '동의하는 것으로 본다'고 적으면서 문서명을 링크 없이 두었고
// 약관 주소도 로그인을 요구해, 가입 전에 읽을 방법이 없었다.
test('로그인 전에도 이용약관과 개인정보 처리방침을 읽을 수 있다', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('login-terms').click();
  await expect(page).toHaveURL(/\/account\/terms$/);
  await expect(page.locator('main')).toContainText('예약·결제·발권을 대행하지 않습니다');
  await page.goto('/login');
  await page.getByTestId('login-privacy').click();
  await expect(page).toHaveURL(/\/account\/privacy$/);
  await expect(page.locator('main')).toContainText('무엇을 받나요');
  // 공지·문의는 계정이 있어야 하므로 여전히 로그인으로 보낸다.
  await page.goto('/account/inquiries');
  await expect(page).toHaveURL('http://localhost:4300/login');
});

for (const path of [
  '/trips',
  '/trips/new',
  '/trips/ai',
  '/trips/private?tab=days',
  '/trips/private/edit',
  '/trips/private/stops/new',
  '/trips/private/stays/new',
]) {
  test(`비로그인 여행 접근 차단: ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL('http://localhost:4300/login');
    await expect(page.getByTestId('login-google')).toBeEnabled();
    await expect(page.getByTestId('trip-header')).toHaveCount(0);
  });
}

test('로그인 상태 확인 중 로딩 표시와 버튼 중복 실행 방지', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/supabase-config.test.json', async (route) => {
    await pending;
    await route.fulfill({ json: { url: authUrl, publishableKey: 'sb_publishable_test-only' } });
  });
  await page.goto('/login');
  await expect(page.getByRole('status', { name: '로그인 상태 확인 중' })).toBeVisible();
  await expect(page.getByTestId('login-google')).toHaveCount(0);
  release();
  await expect(page.getByTestId('login-google')).toBeEnabled();
});

/*
  확인 중 스피너의 자리를 지킨다. 이동이 끝나기 전 잠깐 나타나는 '내 정보'는
  구간이 너무 짧아 이 검사로는 붙잡지 못하므로, 여기서는 확인 중 화면만 본다.
*/
test('세션이 남아 있어도 확인 중에는 스피너만 가운데에 보임', async ({ page }) => {
  /*
    세션이 이미 있는 채로 로그인 화면에 들어오는 상황이다. 로그인 경로에는
    가드가 없어 화면이 먼저 뜨고, 그동안 확인 중 표시만 보여야 한다.
  */
  await page.addInitScript(
    (session) => localStorage.setItem('tc.test.auth.v1', JSON.stringify(session)),
    sessionFor(user),
  );
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/supabase-config.test.json', async (route) => {
    await pending;
    await route.fulfill({ json: { url: authUrl, publishableKey: 'sb_publishable_test-only' } });
  });
  await page.route(`${authUrl}/auth/v1/**`, (route) => route.fulfill({ json: user }));
  await page.goto('/login');

  const settling = page.getByTestId('login-settling');
  await expect(settling).toBeVisible();
  // 확인 중에는 내 정보 본문도 로고도 나타나지 않아야 한다.
  await expect(page.getByRole('heading', { name: '내 정보' })).toHaveCount(0);
  await expect(page.locator('img.intro__mark')).toHaveCount(0);
  await expect(page.getByTestId('login-account')).toHaveCount(0);
  await expect(page.getByRole('link', { name: '여행으로 돌아가기' })).toHaveCount(0);

  // 스피너가 화면 가운데에 온다. 왼쪽 위나 왼쪽 아래로 떨어지면 이 검사가 걸린다.
  const box = (await settling.boundingBox())!;
  const viewport = page.viewportSize()!;
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  expect(Math.abs(centerX - viewport.width / 2)).toBeLessThan(viewport.width * 0.12);
  expect(Math.abs(centerY - viewport.height / 2)).toBeLessThan(viewport.height * 0.25);

  release();
  // 세션이 살아 있으므로 로그인 화면에 머무르지 않고 여행 목록으로 넘어간다.
  await expect(page).toHaveURL('http://localhost:4300/trips');
});

test('세션 갱신 실패 시 여행을 노출하지 않고 재로그인 가능', async ({ page }) => {
  const session = sessionFor(user, Math.floor(Date.now() / 1000) - 120);
  await page.addInitScript((session) => {
    if (!sessionStorage.getItem('expired-seeded')) {
      localStorage.setItem('tc.test.auth.v1', JSON.stringify(session));
      sessionStorage.setItem('expired-seeded', '1');
    }
  }, session);
  await page.route(`${authUrl}/auth/v1/token**`, (route) =>
    route.fulfill({
      status: 400,
      json: { code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' },
    }),
  );
  await page.goto('/trips/private');
  await expect(page).toHaveURL('http://localhost:4300/login');
  await expect(page.getByTestId('trip-header')).toHaveCount(0);
  await expect(page.getByTestId('login-google')).toBeEnabled();
});

test('다른 탭에서 로그아웃하면 열려 있는 여행 화면도 로그인으로 이동', async ({
  page,
  context,
}) => {
  await page.goto('/login');
  await page.evaluate(
    (session) => localStorage.setItem('tc.test.auth.v1', JSON.stringify(session)),
    sessionFor(user),
  );
  await page.goto('/trips');
  await expect(page.getByTestId('empty-trips')).toBeVisible();
  const accountTab = await context.newPage();
  await accountTab.route('**/supabase-config.test.json', (route) =>
    route.fulfill({ json: { url: authUrl, publishableKey: 'sb_publishable_test-only' } }),
  );
  await accountTab.route(`${authUrl}/auth/v1/logout**`, (route) => route.fulfill({ status: 204 }));
  await accountTab.goto('/account');
  await accountTab.getByTestId('logout').click();
  await expect(accountTab).toHaveURL('http://localhost:4300/login');
  await expect(page).toHaveURL('http://localhost:4300/login');
  await expect(page.getByTestId('empty-trips')).toHaveCount(0);
});

for (const fails of [false, true])
  test(`회원탈퇴 확인·결과 (서버 실패: ${fails})`, async ({ page }) => {
    await page.route('**/supabase-config.test.json', (route) =>
      route.fulfill({
        json: {
          url: authUrl,
          publishableKey: 'sb_publishable_test-only',
          accountDeletionEnabled: true,
        },
      }),
    );
    await page.addInitScript(
      ({ user }) => {
        if (sessionStorage.getItem('auth-test-seeded')) return;
        sessionStorage.setItem('auth-test-seeded', '1');
        const expires_at = Math.floor(Date.now() / 1000) + 3600;
        const access_token = `${btoa('{}')}.${btoa(JSON.stringify({ sub: user.id, exp: expires_at }))}.sig`;
        localStorage.setItem(
          'tc.test.auth.v1',
          JSON.stringify({
            user,
            access_token,
            refresh_token: 'test-refresh',
            token_type: 'bearer',
            expires_at,
          }),
        );
      },
      { user },
    );
    await page.route(`${authUrl}/auth/v1/**`, (route) => route.fulfill({ status: 204 }));
    // 탈퇴 확인 화면의 요약: 지울 여행 2개, 넘길 여행 1개
    await page.route(`${authUrl}/rest/v1/rpc/account_deletion_summary`, (route) =>
      route.fulfill({ json: { deleteTrips: 2, handOverTrips: 1 } }),
    );
    let calls = 0;
    await page.route(`${authUrl}/functions/v1/delete-account`, (route) => {
      calls++;
      expect(route.request().postDataJSON()).toEqual({ confirmation: 'DELETE' });
      return route.fulfill(
        fails ? { status: 500, json: { error: 'failed' } } : { json: { deleted: true } },
      );
    });
    await page.goto('/account');
    await expect(page.getByTestId('login-account')).toContainText(user.email);
    // 이 계정의 기기 기록(대화)과 다른 계정의 기록을 하나씩 둔다.
    await page.evaluate((id) => {
      localStorage.setItem(`tc.test.trips.v1.chat.${id}`, '[]');
      localStorage.setItem('tc.test.trips.v1.chat.someone-else', '[]');
    }, user.id);
    await page.getByText('회원탈퇴', { exact: true }).click();
    await expect(page.getByTestId('delete-summary')).toContainText('혼자 쓰는 여행 2개');
    await expect(page.getByTestId('delete-handover')).toContainText('함께 쓰는 여행 1개는 가장 먼저 함께한 사람이 주인이 돼요');
    await expect(page.getByTestId('delete-account')).toBeDisabled();
    expect(calls).toBe(0);
    await page.getByLabel('계정을 삭제하려면').fill('탈퇴');
    await page.getByTestId('delete-account').click();
    if (fails) {
      await expect(page.getByRole('alert')).toContainText('완료하지 못했습니다');
      await expect(page.getByTestId('login-account')).toContainText(user.email);
    } else {
      await expect(page.getByTestId('account-deleted')).toBeVisible();
      await expect(page.getByTestId('login-account')).toHaveCount(0);
      expect(await page.evaluate(() => localStorage.getItem('tc.test.auth.v1'))).toBeNull();
      // 이 계정의 기기 기록만 지우고 다른 계정의 기록은 남긴다.
      expect(await page.evaluate((id) => localStorage.getItem(`tc.test.trips.v1.chat.${id}`), user.id)).toBeNull();
      expect(await page.evaluate(() => localStorage.getItem('tc.test.trips.v1.chat.someone-else'))).toBe('[]');
      await page.reload();
      await expect(page.getByTestId('login-google')).toBeEnabled();
    }
    expect(calls).toBe(1);
  });
