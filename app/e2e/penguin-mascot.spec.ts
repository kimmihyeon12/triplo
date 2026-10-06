import { expect, test, type Page } from '@playwright/test';
import { createTrip, expectNoHorizontalScroll, resetApp } from './helpers';

async function checkEntry(page: Page) {
  const entry = page.getByTestId('open-chat');
  await expect(entry).toHaveText('AI 챗봇');
  await expect(entry).toHaveAccessibleName('AI 챗봇 열기');
  await expect(entry.locator('svg')).toHaveCount(0);
  const image = entry.locator('img');
  await expect(image).toHaveAttribute('src', '/brand/companion-penguin-v1.png');
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  const box = (await entry.boundingBox())!;
  expect(box.height).toBe(48);
  expect(box.width).toBe(80);
  const face = (await image.boundingBox())!;
  const label = (await entry.locator('span').boundingBox())!;
  expect(face.width).toBe(64);
  expect(face.height).toBe(48);
  expect(label.x).toBeGreaterThan(box.x);
  expect(label.x + label.width).toBeLessThan(box.x + box.width);
  expect(face.y).toBeLessThan(box.y);
  expect(face.y).toBeGreaterThanOrEqual(0);
  expect(face.y + face.height).toBeGreaterThan(box.y);
  expect(face.y + face.height).toBeLessThan(label.y);
  expect(await entry.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(22, 24, 29)');
  expect(await entry.evaluate(el => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)');
  if (await page.evaluate(() => matchMedia('(hover: hover)').matches)) {
    await entry.hover();
    await expect(entry).toHaveCSS('background-color', 'rgb(43, 47, 56)');
    await page.mouse.move(0, 0);
  }
  await expectNoHorizontalScroll(page);
}

test('기존 색 버튼 위에 펭이가 올라앉고 대화에는 전신을 사용한다', async ({ page }, testInfo) => {
  await resetApp(page);
  await checkEntry(page);
  await page.screenshot({ path: `../output/playwright/penguin-${testInfo.project.name}-list.png` });
  await page.getByTestId('open-chat').click();
  // 2026-09-28부터 제목과 [새 대화]는 상단 바가 맡고, 펭이는 대화를 시작하기 전
  // 빈 화면에만 선다. 대화가 시작되면 말풍선만 남는다.
  const welcome = page.locator('app-chat-thread img').first();
  await expect(welcome).toHaveAttribute('src', '/brand/companion-penguin-v1.png');
  await expect.poll(() => welcome.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  expect(await welcome.evaluate(img => getComputedStyle(img).objectFit)).toBe('contain');
  await page.screenshot({ path: `../output/playwright/penguin-${testInfo.project.name}-welcome.png` });
  await page.getByTestId('chat-input').fill('3일 쉬는데 어디 가지');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-assistant-message').first()).toBeVisible();
  await expect(page.locator('app-chat-thread img')).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `../output/playwright/penguin-${testInfo.project.name}-chat.png` });
  await page.getByTestId('chat-input').fill('아직 보내지 않은 메시지');
  await page.getByTestId('chat-new').click();
  await expect(page.getByTestId('chat-assistant-message')).toHaveCount(0);
  await expect(page.getByTestId('chat-input')).toHaveValue('');
  await page.reload();
  await expect(page.getByTestId('chat-user-message')).toHaveCount(0);

  const tripId = await createTrip(page, { title: '펭이와 여행', regions: ['강릉시'] });
  await page.goto(`/trips/${tripId}`);
  await checkEntry(page);
  const entryBox = (await page.getByTestId('open-chat').boundingBox())!;
  const addBox = (await page.getByTestId('add-open').boundingBox())!;
  expect(entryBox.y + entryBox.height).toBeLessThan(addBox.y);
  await page.screenshot({ path: `../output/playwright/penguin-${testInfo.project.name}-detail.png` });
  await page.getByTestId('open-chat').click();
  await expect(page.getByTestId('chat-sheet')).toBeVisible();
  await expect(page.getByTestId('chat-sheet').locator('header img')).toHaveAttribute('width', '48');
  await expect(page.getByTestId('chat-sheet').locator('header img')).toHaveAttribute('src', '/brand/companion-penguin-v1.png');
  await expect(page.getByTestId('chat-sheet').locator('h2')).toHaveText('AI 챗봇');
  await expect(page.getByTestId('chat-sheet')).not.toContainText('구름이');
  await expect(page.getByTestId('chat-sheet').locator('header')).not.toContainText('밤이');
  await expect(page.getByTestId('chat-sheet').locator('app-chat-thread img')).toHaveCount(0);
  await page.screenshot({ path: `../output/playwright/penguin-${testInfo.project.name}-sheet.png` });
  await page.getByTestId('chat-input').fill('여행지 랜덤으로 뽑아줘');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-assistant-message')).toHaveCount(1);
  await page.getByTestId('chat-input').fill('입력 중');
  await page.getByTestId('chat-new').click();
  await expect(page.getByTestId('chat-assistant-message')).toHaveCount(0);
  await expect(page.getByTestId('chat-input')).toHaveValue('');
  await expect(page.getByTestId('chat-sheet')).toContainText('펭이와 여행');
  await page.getByTestId('chat-sheet-close').click();
  await expect(page.getByTestId('chat-sheet')).toHaveCount(0);
});
