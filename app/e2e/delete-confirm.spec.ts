import { expect, test, type Page } from '@playwright/test';
import { addStop, chooseRowMenu, createTrip, resetApp } from './helpers';

/**
 * 화면 아래쪽 행에서 삭제 확인을 열면 떠 있는 AI 챗봇 버튼·일정 추가 바가 그 칸을 덮었다
 * (2026-10-07 사용자 제보). 확인 칸은 덮이지 않는 자리까지 올라와야 한다.
 */
test.describe('삭제 확인 칸 가림', () => {
  test.beforeEach(async ({ page }) => resetApp(page));

  test('마지막 장소의 삭제 확인이 떠 있는 버튼에 가리지 않는다', async ({ page }) => {
    const id = await createTrip(page, {
      title: '가림 확인',
      start: '2026-11-01',
      end: '2026-11-02',
      regions: ['강릉시'],
    });
    for (const n of ['하나', '둘', '셋']) await addStop(page, id, { name: n, date: '2026-11-01' });
    await page.goto(`/trips/${id}`);
    // 마지막 행의 더보기를 일정 추가 바 바로 위에 둔다. 사용자가 끝까지 내려 누르는 자리다.
    await page.locator('summary[aria-label="셋 더보기"]').scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const r = document.querySelector('summary[aria-label="셋 더보기"]')!.getBoundingClientRect();
      scrollBy(0, r.bottom - (innerHeight - 205));
    });
    await chooseRowMenu(page, '셋', '삭제');

    const confirm = page.locator('[data-testid^="confirm-delete-"]');
    await expect(confirm).toBeVisible();
    await expect.poll(() => coveredBy(page, confirm)).toEqual([]);
  });
});

/** 확인 버튼과 겹치는 떠 있는 요소(챗봇 버튼·펭귄 그림·일정 추가 바) 이름을 돌려준다. */
async function coveredBy(page: Page, target: ReturnType<Page['locator']>): Promise<string[]> {
  const box = await target.boundingBox();
  if (!box) return ['no box'];
  return page.evaluate((b) => {
    const floats: [string, Element | null][] = [
      ['open-chat', document.querySelector('[data-testid="open-chat"]')],
      ['penguin', document.querySelector('[data-testid="open-chat"] img')],
      ['action-bar', document.querySelector('.action-bar')],
    ];
    return floats
      .filter(([, el]) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.left < b.x + b.width && r.right > b.x && r.top < b.y + b.height && r.bottom > b.y;
      })
      .map(([name]) => name);
  }, box);
}
