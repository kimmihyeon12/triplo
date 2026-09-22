import { expect, test, type Page } from '@playwright/test';
import { STORAGE_KEY, addStop, createTrip, expectNoHorizontalScroll, resetApp } from './helpers';

/**
 * 대화형 여행 탐색. 테스트 앱은 외부를 부르지 않는 고정 응답 제공자를 쓴다.
 *
 * 고정 응답은 입력의 열쇳말로 갈래를 고른다. 초안은 안목해변·오죽헌·
 * 속초관광수산시장을 내고 '없는장소테스트'는 장소 검색이 찾지 못한다.
 */

const CHAT_FAIL = 'tc.test.chatFail';
const CHAT_DELAY = 'tc.test.chatDelayMs';

async function setFlag(page: Page, key: string, value: string | null): Promise<void> {
  await page.evaluate(
    ([k, v]) => (v === null ? localStorage.removeItem(k!) : localStorage.setItem(k!, v)),
    [key, value],
  );
}

function savedTrips(
  page: Page,
): Promise<{ id: string; stops: { name: string; location: unknown }[] }[]> {
  return page.evaluate(async (key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const saved = JSON.parse(raw) as { trips: Record<string, unknown> };
    return Object.values(saved.trips) as never;
  }, STORAGE_KEY);
}

/** 목록의 떠 있는 버튼으로 대화 화면을 연다. */
async function openChat(page: Page): Promise<void> {
  await page.goto('/trips');
  await page.getByTestId('open-chat').click();
  await expect(page.getByTestId('chat-input')).toBeVisible();
}

async function say(page: Page, text: string): Promise<void> {
  await page.getByTestId('chat-input').fill(text);
  await page.getByTestId('chat-send').click();
}

test('일정 짜기와 AI 챗봇은 서로 다른 진입점을 쓴다', async ({ page }) => {
  await resetApp(page);

  // 목록의 AI 카드는 조건을 고르는 단계형으로 바로 간다.
  await page.getByTestId('empty-ai').click();
  await expect(page).toHaveURL(/\/trips\/ai$/);
  await expect(page.getByTestId('ai-region-input')).toBeVisible();

  // 대화는 떠 있는 버튼으로 따로 연다. 한쪽이 다른 쪽 안에 들어가지 않는다.
  await page.goto('/trips');
  await page.getByTestId('open-chat').click();
  await expect(page).toHaveURL(/\/trips\/chat$/);
  await expect(page.getByTestId('chat-input')).toBeVisible();
});

test('대화 말풍선에 누가 말하는지 아이콘으로 표시한다', async ({ page }) => {
  await resetApp(page);
  await openChat(page);

  await say(page, '3일 쉬는데 어디 가지');
  await expect(page.getByTestId('chat-bot-avatar').last()).toBeVisible();
  // 사용자 말풍선에는 붙이지 않는다. 누가 말하는지 이미 자리로 알 수 있다.
  const avatars = await page.getByTestId('chat-bot-avatar').count();
  const replies = await page.getByTestId('chat-assistant-message').count();
  expect(avatars).toBe(replies);
});

test('대화로 찾아 담으면 새 여행이 만들어진다', async ({ page }) => {
  await resetApp(page);
  await openChat(page);

  await say(page, '강릉으로 일정 짜줘');
  await expect(page.getByTestId('confirm-card')).toBeVisible();

  // 확인 카드는 담길 장소를 보여주고, 검색이 찾지 못한 이름은 들이지 않는다.
  await expect(page.getByTestId('confirm-after')).toContainText('안목해변');
  await expect(page.getByTestId('confirm-after')).not.toContainText('없는장소테스트');

  await page.getByTestId('confirm-apply').click();
  await expect(page.getByTestId('chat-saved-bar')).toBeVisible();

  const trips = await savedTrips(page);
  expect(trips).toHaveLength(1);
  expect(trips[0]!.stops.length).toBeGreaterThan(0);
  // 담은 장소에는 검색으로 확인한 좌표가 함께 저장된다.
  expect(trips[0]!.stops.every((s) => s.location !== null)).toBe(true);

  await page.getByTestId('chat-go-trip').click();
  await expect(page.getByTestId('trip-header')).toBeVisible();
});

test('담은 뒤 되돌리면 일정에서 빠진다', async ({ page }) => {
  await resetApp(page);
  await openChat(page);
  await say(page, '강릉으로 일정 짜줘');
  await page.getByTestId('confirm-apply').click();
  await expect(page.getByTestId('chat-saved-bar')).toBeVisible();

  await page.getByTestId('confirm-undo').click();
  await expect(page.getByTestId('confirm-apply')).toBeVisible();
  const trips = await savedTrips(page);
  expect(trips[0]!.stops).toHaveLength(0);
});

test('여행과 무관한 질문에는 정해진 안내가 나오고 초안이 생기지 않는다', async ({ page }) => {
  await resetApp(page);
  await openChat(page);

  await say(page, '코드 짜줘');
  const last = page.getByTestId('chat-assistant-message').last();
  await expect(last).toContainText('국내 여행 일정');
  await expect(page.getByTestId('confirm-card')).toHaveCount(0);
  // 다시 물을 수 있도록 칩이 남는다.
  await expect(page.getByTestId('chat-chips')).toBeVisible();
});

test('영업정보는 AI 답변임을 밝히고 확인 링크를 함께 준다', async ({ page }) => {
  await resetApp(page);
  await openChat(page);

  await say(page, '불국사 몇 시에 열어');
  await expect(page.getByTestId('ai-disclaimer')).toBeVisible();
  await expect(page.getByTestId('ai-disclaimer')).toContainText('부정확할 수 있습니다');

  const naver = page.getByTestId('reference-link-네이버 지도');
  const kakao = page.getByTestId('reference-link-카카오맵');
  await expect(naver).toHaveAttribute('href', /map\.naver\.com/);
  await expect(kakao).toHaveAttribute('href', /map\.kakao\.com/);
});

test('랜덤 뽑기는 모델을 부르지 않고 실재하는 지역을 준다', async ({ page }) => {
  await resetApp(page);
  await openChat(page);

  // 고정 응답이 실패하도록 해 두어도 답이 나오면 모델을 부르지 않은 것이다.
  await setFlag(page, CHAT_FAIL, '1');
  await say(page, '아무 데나 뽑아줘');
  await expect(page.getByTestId('chat-assistant-message').last()).toContainText('어떠세요');
  await expect(page.getByTestId('chat-error')).toHaveCount(0);
});

test('칩을 누르면 그 말이 그대로 전해진다', async ({ page }) => {
  await resetApp(page);
  await openChat(page);

  const chip = page.getByTestId('chat-chip').first();
  const label = (await chip.textContent())?.trim() ?? '';
  await chip.click();
  await expect(page.getByTestId('chat-user-message').last()).toHaveText(label);
});

test('연결 실패를 알리고 주고받은 말을 지우지 않는다', async ({ page }) => {
  await resetApp(page);
  await openChat(page);

  await setFlag(page, CHAT_FAIL, '1');
  await say(page, '3일 쉬는데 어디 가지');
  await expect(page.getByTestId('chat-error')).toBeVisible();
  // 물어본 말은 그대로 남아 다시 시도할 때 문맥이 이어진다.
  await expect(page.getByTestId('chat-user-message').last()).toContainText('3일 쉬는데');
});

test('기다리는 동안 그만둘 수 있다', async ({ page }) => {
  await resetApp(page);
  await openChat(page);

  await setFlag(page, CHAT_DELAY, '3000');
  await say(page, '3일 쉬는데 어디 가지');
  await expect(page.getByTestId('chat-pending')).toBeVisible();
  await page.getByTestId('chat-cancel').click();
  await expect(page.getByTestId('chat-pending')).toHaveCount(0);
});

test('여행 상세에서 떠 있는 버튼으로 시트를 열고 순서를 고친다', async ({ page }) => {
  await resetApp(page);
  const tripId = await createTrip(page, {
    title: '강릉 여행',
    start: '2026-05-01',
    end: '2026-05-02',
    regions: ['강릉시'],
  });
  // 좌표가 있어야 동선을 계산할 수 있다. 장소 검색으로 담아 좌표를 채운다.
  await addStop(page, tripId, { name: '안목해변', date: '2026-05-01' });
  await addStop(page, tripId, { name: '오죽헌', date: '2026-05-01' });

  await page.goto(`/trips/${tripId}`);
  await expect(page.getByTestId('open-chat')).toBeVisible();
  await page.getByTestId('open-chat').click();
  await expect(page.getByTestId('chat-sheet')).toBeVisible();

  // 시트가 열린 동안 뒤 배경은 구르지 않는다.
  const overflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
  expect(overflow).toBe('hidden');

  await page.getByTestId('chat-sheet-close').click();
  await expect(page.getByTestId('chat-sheet')).toHaveCount(0);
});

test('시트 손잡이로 높이를 바꾼다', async ({ page }) => {
  await resetApp(page);
  const tripId = await createTrip(page, { title: '강릉 여행', regions: ['강릉시'] });
  await page.goto(`/trips/${tripId}`);
  await page.getByTestId('open-chat').click();

  const sheet = page.getByTestId('chat-sheet');
  const half = (await sheet.boundingBox())!.height;
  await page.getByTestId('chat-sheet-handle').click();
  await expect(page.getByTestId('chat-sheet-handle')).toHaveAttribute('aria-expanded', 'true');
  const full = (await sheet.boundingBox())!.height;
  expect(full).toBeGreaterThan(half);
});

test('360px에서 떠 있는 버튼이 마지막 항목을 가리지 않는다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '좁은 화면에서만 확인한다');
  await resetApp(page);
  const tripId = await createTrip(page, {
    title: '강릉 여행',
    start: '2026-05-01',
    end: '2026-05-01',
    regions: ['강릉시'],
  });
  await addStop(page, tripId, { name: '안목해변', date: '2026-05-01' });

  await page.goto(`/trips/${tripId}`);
  await page.mouse.wheel(0, 5000);
  await expectNoHorizontalScroll(page);

  // 맨 아래까지 내렸을 때 마지막 장소와 떠 있는 버튼이 겹치지 않아야 한다.
  const button = (await page.getByTestId('open-chat').boundingBox())!;
  const lastStop = (await page.getByText('안목해변').last().boundingBox())!;
  const overlaps =
    lastStop.x < button.x + button.width &&
    lastStop.x + lastStop.width > button.x &&
    lastStop.y < button.y + button.height &&
    lastStop.y + lastStop.height > button.y;
  expect(overlaps, '떠 있는 버튼이 마지막 항목을 가리지 않아야 한다').toBe(false);
});

test('키보드만으로 물어보고 확인 카드까지 간다', async ({ page }) => {
  await resetApp(page);
  await openChat(page);

  await page.getByTestId('chat-input').focus();
  await page.keyboard.type('강릉으로 일정 짜줘');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('confirm-card')).toBeVisible();

  // 카드의 버튼에 탭으로 닿을 수 있어야 한다.
  await page.getByTestId('confirm-apply').focus();
  await expect(page.getByTestId('confirm-apply')).toBeFocused();
});
