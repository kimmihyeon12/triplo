import { test, expect } from '@playwright/test';
import { resetApp, createTrip, addStop, addStay } from './helpers';

/** 티켓 머리글과 접기 상태에 따른 이미지 저장 범위를 확인한다. */

async function setUpTrip(page: import('@playwright/test').Page): Promise<string> {
  await resetApp(page);
  const id = await createTrip(page, {
    title: '부산 통영 여행',
    start: '2026-10-02',
    end: '2026-10-04',
    regions: ['부산', '통영'],
  });
  await addStop(page, id, { name: '광안리해수욕장', date: '2026-10-02', region: '부산' });
  await addStop(page, id, { name: '자갈치시장', date: '2026-10-02', region: '부산' });
  await addStop(page, id, { name: '동피랑벽화마을', date: '2026-10-03', region: '통영' });
  await addStay(page, id, {
    name: '해운대 호텔',
    checkIn: '2026-10-02',
    checkOut: '2026-10-04',
    region: '부산',
  });
  return id;
}

/**
 * 저장 버튼이 만드는 PNG를 내려받지 않고 가로챈다. 실제 렌더링 경로를 그대로 쓰되
 * 파일 시스템에 쓰지 않아 검증이 빠르다.
 */
async function capturePng(
  page: import('@playwright/test').Page,
): Promise<{ width: number; height: number }> {
  return await page.evaluate(async () => {
    const button = document.querySelector<HTMLButtonElement>('[data-testid="download-itinerary"]');
    if (!button) throw new Error('저장 버튼을 찾지 못했습니다.');
    let captured: Blob | null = null;
    const originalCreate = URL.createObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (blob: Blob) => {
      captured = blob;
      return 'blob:captured';
    };
    HTMLAnchorElement.prototype.click = function () {};
    try {
      button.click();
      const deadline = Date.now() + 8000;
      while (!captured && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 100));
    } finally {
      URL.createObjectURL = originalCreate;
      HTMLAnchorElement.prototype.click = originalClick;
    }
    if (!captured) throw new Error('이미지를 만들지 못했습니다.');
    const bitmap = await createImageBitmap(captured);
    return { width: bitmap.width, height: bitmap.height };
  });
}

test('티켓 머리글에 기간·지역·티켓 번호가 보이고 초대 화면과 번호가 같다', async ({ page }) => {
  const id = await setUpTrip(page);

  await page.goto(`/trips/${id}/export`);
  const ticket = page.getByTestId('export-ticket');
  await expect(ticket).toBeVisible();
  await expect(ticket).toContainText('부산 통영 여행');
  await expect(ticket).toContainText('트립플로');

  const snapshot = page.locator('app-itinerary-snapshot');
  await expect(snapshot).toContainText('2박 3일');
  await expect(snapshot).toContainText('부산 · 통영');
  const exportNo = (await snapshot.textContent())?.match(/TR-[A-Z0-9]{4}-[A-Z0-9]{4}/)?.[0];
  expect(exportNo, '티켓 번호가 영문과 숫자로 표시되어야 한다').toBeTruthy();

  await page.goto(`/trips/${id}/invite`);
  const inviteTicket = page.getByTestId('invite-ticket');
  await expect(inviteTicket).toBeVisible();
  const inviteNo = (await inviteTicket.textContent())?.match(/TR-[A-Z0-9]{4}-[A-Z0-9]{4}/)?.[0];
  expect(inviteNo, '같은 여행이면 두 화면의 티켓 번호가 같아야 한다').toBe(exportNo);
});

test('날짜를 접으면 요약만 남고 전부 접으면 티켓만 남는다', async ({ page }) => {
  const id = await setUpTrip(page);
  await page.goto(`/trips/${id}/export`);

  const snapshot = page.locator('app-itinerary-snapshot');
  await expect(snapshot).toContainText('광안리해수욕장');

  // 첫날만 접으면 그날 항목은 사라지고 요약 한 줄이 대신 들어간다.
  const firstDay = page.getByTestId('toggle-section-2026-10-02');
  await expect(firstDay).toHaveAttribute('aria-expanded', 'true');
  await firstDay.click();
  await expect(firstDay).toHaveAttribute('aria-expanded', 'false');
  await expect(snapshot).not.toContainText('광안리해수욕장');
  await expect(firstDay).toContainText('장소 3곳');
  // 다른 날은 그대로 펼쳐져 있다.
  await expect(snapshot).toContainText('동피랑벽화마을');

  // 전부 접으면 일정 목록 자리가 사라지고 티켓만 남는다.
  await page.getByTestId('toggle-all-sections').click();
  await expect(snapshot).not.toContainText('동피랑벽화마을');
  await expect(snapshot).not.toContainText('광안리해수욕장');
  // 티켓 정보는 그대로 남는다.
  await expect(snapshot).toContainText('2박 3일');
  await expect(page.getByTestId('toggle-all-sections')).toContainText('모두 펼치기');
});

test('접은 상태로 저장하면 펼친 상태보다 짧은 이미지가 나온다', async ({ page }) => {
  const id = await setUpTrip(page);
  await page.goto(`/trips/${id}/export`);
  await expect(page.locator('app-itinerary-snapshot')).toContainText('광안리해수욕장');

  const full = await capturePng(page);

  await page.getByTestId('toggle-all-sections').click();
  await expect(page.locator('app-itinerary-snapshot')).not.toContainText('광안리해수욕장');
  const ticketOnly = await capturePng(page);

  // 폭은 접기와 무관하게 같고, 높이만 담긴 내용에 따라 달라진다.
  expect(ticketOnly.width).toBe(full.width);
  expect(ticketOnly.height, '티켓만 저장하면 전체 일정보다 짧아야 한다').toBeLessThan(full.height);
});
