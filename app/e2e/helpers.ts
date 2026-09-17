import { expect, type Page } from '@playwright/test';

export const STORAGE_KEY = 'tc.test.trips.v1';
export const FAIL_FLAG = 'tc.test.trips.v1.failSave';

/** 테스트 앱 저장소를 비우고 목록 화면에서 시작한다. */
export async function resetApp(page: Page): Promise<void> {
  // Exercise the real route guard with an isolated authenticated fixture session.
  await page.route('**/supabase-config.test.json', (route) =>
    route.fulfill({
      json: { url: 'https://auth.test.supabase.co', publishableKey: 'sb_publishable_test-only' },
    }),
  );
  await page.addInitScript(() => {
    const user = {
      id: 'trip-test-user',
      email: 'trips@example.com',
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: { provider: 'google' },
      user_metadata: { travel_nickname: '여행테스터' },
    };
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
  });
  await page.goto('/trips');
  await page.evaluate(
    ([key, flag]) => {
      localStorage.removeItem(key);
      localStorage.removeItem(flag);
      localStorage.removeItem('tc.test.mapFail');
      localStorage.removeItem('tc.test.mapDelayMs');
      localStorage.removeItem('tc.test.aiFail');
      localStorage.removeItem('tc.test.aiDelayMs');
    },
    [STORAGE_KEY, FAIL_FLAG],
  );
  await page.goto('/trips');
  await expect(page.getByTestId('empty-trips')).toBeVisible();
}

export interface TripInput {
  title?: string;
  start?: string;
  end?: string;
  regions?: string[];
}

/** 여행 만들기 폼을 채우고 저장한 뒤 상세 화면의 id를 돌려준다. */
export async function createTrip(page: Page, input: TripInput): Promise<string> {
  await page.goto('/trips/new');
  if (input.title) await page.getByTestId('trip-title').fill(input.title);
  if (input.start) await page.getByTestId('trip-start').fill(input.start);
  if (input.end) await page.getByTestId('trip-end').fill(input.end);
  // 지역은 고정 목록에서 고른다. 검색어를 넣고 나온 후보를 누른다.
  for (const r of input.regions ?? []) {
    await page.getByTestId('region-input').fill(r);
    await page.getByTestId(`region-match-${r}`).click();
  }
  await page.getByTestId('trip-save').click();
  await expect(page).toHaveURL(/\/trips\/[^/]+$/);
  await expect(page.getByTestId('trip-header')).toBeVisible();
  const url = page.url();
  return url.substring(url.lastIndexOf('/') + 1);
}

export interface StopInput {
  name: string;
  kind?: 'place' | 'meal' | 'break' | 'buffer';
  date?: string;
  region?: string;
  address?: string;
  stayMinutes?: number;
  fixedTime?: string;
  memo?: string;
}

export async function addStop(page: Page, tripId: string, input: StopInput): Promise<void> {
  await page.goto(`/trips/${tripId}/stops/new`);
  await expect(page.getByTestId('stop-name')).toBeVisible();
  if (input.kind) await page.getByRole('radio', { name: kindLabel(input.kind) }).check();
  await page.getByTestId('stop-name').fill(input.name);
  // 지역은 고르지 않고 주소에서 정해진다. region을 넘기면 주소에 지역명을 담아
  // 실제 검색 결과와 같은 모양으로 만든다.
  const stopAddress = input.address ?? (input.region ? `강원 ${input.region}시 어딘가` : '');
  if (stopAddress) await page.getByTestId('stop-address').fill(stopAddress);
  if (input.date) await page.getByTestId('stop-date').selectOption(input.date);
  if (input.stayMinutes !== undefined)
    await page.getByTestId('stop-stay').fill(String(input.stayMinutes));
  if (input.fixedTime) await page.getByTestId('stop-fixed').fill(input.fixedTime);
  if (input.memo) await page.getByTestId('stop-memo').fill(input.memo);
  await page.getByTestId('stop-save').click();
  await expect(page).toHaveURL(new RegExp(`/trips/${tripId}(\\?|$)`));
}

export interface StayInput {
  name: string;
  checkIn: string;
  checkOut: string;
  region?: string;
  address?: string;
  checkInTime?: string;
  confirmWarnings?: boolean;
}

export async function addStay(page: Page, tripId: string, input: StayInput): Promise<void> {
  await page.goto(`/trips/${tripId}/stays/new`);
  await expect(page.getByTestId('stay-name')).toBeVisible();
  await page.getByTestId('stay-name').fill(input.name);
  // 지역은 고르지 않고 주소에서 정해진다. region을 넘기면 주소에 지역명을 담는다.
  const stayAddress = input.address ?? (input.region ? `강원 ${input.region}시 어딘가` : '');
  if (stayAddress) await page.getByTestId('stay-address').fill(stayAddress);
  await page.getByTestId('stay-checkin').fill(input.checkIn);
  await page.getByTestId('stay-checkout').fill(input.checkOut);
  if (input.checkInTime) await page.getByTestId('stay-checkin-time').fill(input.checkInTime);
  if (input.confirmWarnings) await page.getByTestId('stay-warning-confirm').check();
  await page.getByTestId('stay-save').click();
  await expect(page).toHaveURL(new RegExp(`/trips/${tripId}\\?tab=stays`));
}

function kindLabel(kind: NonNullable<StopInput['kind']>): string {
  return { place: '장소', meal: '식사', break: '휴식', buffer: '여유시간' }[kind];
}

/**
 * 여행 정보 수정·삭제 등은 상단 바 더보기 안에 있으므로 메뉴를 먼저 연다.
 * 여는 장치가 summary라서 button 역할로는 찾히지 않는다.
 */
export async function openTripMenu(page: Page): Promise<void> {
  await page.locator('summary[aria-label="여행 더보기"]').click();
}

/** 목록 행의 제외·편집·삭제는 행 더보기 안에 있다. 행 이름으로 여는 장치를 찾는다. */
export async function openRowMenu(page: Page, rowName: string): Promise<void> {
  await page.locator(`summary[aria-label="${rowName} 더보기"]`).click();
}

/** 행 더보기를 열고 항목 하나를 고른다. */
export async function chooseRowMenu(page: Page, rowName: string, item: string): Promise<void> {
  await openRowMenu(page, rowName);
  await page.getByRole('menuitem', { name: item }).click();
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, '가로 스크롤이 없어야 한다').toBeLessThanOrEqual(0);
}
