import { expect, type Page } from '@playwright/test';

export const STORAGE_KEY = 'tc.test.trips.v1';
export const FAIL_FLAG = 'tc.test.trips.v1.failSave';

/** 테스트 앱 저장소를 비우고 목록 화면에서 시작한다. */
export async function resetApp(page: Page): Promise<void> {
  await page.goto('/trips');
  await page.evaluate(
    ([key, flag]) => {
      localStorage.removeItem(key);
      localStorage.removeItem(flag);
      localStorage.removeItem('tc.test.mapFail');
      localStorage.removeItem('tc.test.mapDelayMs');
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
  for (const r of input.regions ?? []) {
    await page.getByTestId('region-input').fill(r);
    await page.getByTestId('region-add').click();
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
  if (input.address) await page.getByTestId('stop-address').fill(input.address);
  if (input.region) await page.getByTestId('stop-region').selectOption({ label: input.region });
  if (input.date) await page.getByTestId('stop-date').selectOption(input.date);
  if (input.stayMinutes !== undefined) await page.getByTestId('stop-stay').fill(String(input.stayMinutes));
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
  if (input.address) await page.getByTestId('stay-address').fill(input.address);
  if (input.region) await page.getByTestId('stay-region').selectOption({ label: input.region });
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

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, '가로 스크롤이 없어야 한다').toBeLessThanOrEqual(0);
}
