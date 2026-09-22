import { expect, test, type Page } from '@playwright/test';
import { createTrip, expectNoHorizontalScroll, resetApp } from './helpers';

async function checkEntry(page: Page) {
  const entry = page.getByTestId('open-chat');
  await expect(entry).toHaveText('AI 챗봇');
  await expect(entry).toHaveAccessibleName('AI 챗봇 열기');
  await expect(entry.locator('svg')).toHaveCount(0);
  const image = entry.locator('img');
  await expect(image).toHaveAttribute('src', '/brand/companion-cloud-sleepy-v1.png');
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  const box = (await entry.boundingBox())!;
  expect(box.height).toBe(44);
  expect(box.width).toBeLessThan(150);
  expect((await image.boundingBox())!.width).toBe(56);
  await expectNoHorizontalScroll(page);
}

test('구름이 전신과 작은 AI 챗봇 버튼을 목록·상세에서 사용한다', async ({ page }, testInfo) => {
  await resetApp(page);
  await checkEntry(page);
  await page.screenshot({ path: `../output/playwright/cloud-${testInfo.project.name}-list.png` });
  await page.getByTestId('open-chat').click();
  await page.getByTestId('chat-input').fill('3일 쉬는데 어디 가지');
  await page.getByTestId('chat-send').click();
  const avatar = page.locator('app-chat-page header img');
  await expect(avatar).toHaveAttribute('src', '/brand/companion-cloud-sorry-v1.png');
  await expect.poll(() => avatar.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  expect((await avatar.boundingBox())!.width).toBe(48);
  expect(await avatar.evaluate(img => getComputedStyle(img).objectFit)).toBe('contain');
  await expect(page.locator('app-chat-thread img')).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `../output/playwright/cloud-${testInfo.project.name}-chat.png` });
  await page.getByTestId('chat-input').fill('아직 보내지 않은 메시지');
  await page.getByTestId('chat-new').click();
  await expect(page.getByTestId('chat-assistant-message')).toHaveCount(0);
  await expect(page.getByTestId('chat-input')).toHaveValue('');
  await page.reload();
  await expect(page.getByTestId('chat-user-message')).toHaveCount(0);

  const tripId = await createTrip(page, { title: '구름이와 여행', regions: ['강릉시'] });
  await page.goto(`/trips/${tripId}`);
  await checkEntry(page);
  const entryBox = (await page.getByTestId('open-chat').boundingBox())!;
  const addBox = (await page.getByTestId('add-open').boundingBox())!;
  expect(entryBox.y + entryBox.height).toBeLessThan(addBox.y);
  await page.screenshot({ path: `../output/playwright/cloud-${testInfo.project.name}-detail.png` });
  await page.getByTestId('open-chat').click();
  await expect(page.getByTestId('chat-sheet')).toBeVisible();
  await expect(page.getByTestId('chat-sheet').locator('header img')).toHaveAttribute('width', '48');
  await expect(page.getByTestId('chat-sheet').locator('app-chat-thread img')).toHaveCount(0);
  await page.screenshot({ path: `../output/playwright/cloud-${testInfo.project.name}-sheet.png` });
  await page.getByTestId('chat-input').fill('여행지 랜덤으로 뽑아줘');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-assistant-message')).toHaveCount(1);
  await page.getByTestId('chat-input').fill('입력 중');
  await page.getByTestId('chat-new').click();
  await expect(page.getByTestId('chat-assistant-message')).toHaveCount(0);
  await expect(page.getByTestId('chat-input')).toHaveValue('');
  await expect(page.getByTestId('chat-sheet')).toContainText('구름이와 여행');
  await page.getByTestId('chat-sheet-close').click();
  await expect(page.getByTestId('chat-sheet')).toHaveCount(0);
});
