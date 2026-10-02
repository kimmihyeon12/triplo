import { expect, test } from '@playwright/test';
import { createTrip, resetApp, STORAGE_KEY } from './helpers';

/**
 * 정산 화면은 여행 기능의 라우트에서 다른 기능의 화면을 붙이는 자리다.
 * 그 연결이 끊기면 빈 화면이 되는데, 상세 화면 검사만으로는 드러나지 않는다.
 */
test.describe('정산 화면 진입', () => {
  test.beforeEach(async ({ page }) => resetApp(page));

  test('여행 상세에서 정산으로 들어가면 화면이 열린다', async ({ page }) => {
    const id = await createTrip(page, {
      title: '정산 확인',
      start: '2026-05-01',
      end: '2026-05-02',
      regions: ['강릉시'],
    });

    await page.getByTestId('go-expenses').click();
    await expect(page).toHaveURL(new RegExp(`/trips/${id}/expenses`));
    await expect(page.getByTestId('panel-expenses')).toBeVisible();
  });

  test('일정의 정산하기로 들어오면 나를 결제자로, 모두를 분담 대상으로 둔다', async ({ page }) => {
    const id = await createTrip(page, {
      title: '정산하기 진입',
      start: '2026-05-01',
      end: '2026-05-02',
      regions: ['강릉시'],
    });

    await page.goto(`/trips/${id}/expenses?add=none`);
    await expect(page.locator('#expense-payer')).toHaveAttribute('data-value', 'self');
    await expect(page.locator('#expense-share-self')).toBeChecked();
  });

  test('정산할 사람은 이름 옆 X로 지우고, 나에게는 X가 없다', async ({ page }) => {
    const id = await createTrip(page, {
      title: '사람 지우기',
      start: '2026-05-01',
      end: '2026-05-02',
      regions: ['강릉시'],
    });

    await page.goto(`/trips/${id}/expenses`);
    await page.getByText(/정산할 사람 ·/).click();
    await page.getByLabel('정산할 사람 이름').fill('민지');
    await page.getByRole('button', { name: '추가', exact: true }).click();
    await expect(page.getByRole('button', { name: '민지 지우기' })).toBeVisible();
    await expect(page.getByTestId('remove-person-self')).toHaveCount(0);

    await page.getByRole('button', { name: '민지 지우기' }).click();
    await expect(page.getByRole('button', { name: '민지 지우기' })).toHaveCount(0);
    await expect(page.getByText(/정산할 사람 · 1명/)).toBeVisible();
  });

  test('열린 선택 목록을 터치로 다시 누르면 닫힌다', async ({ page }, info) => {
    test.skip(!info.project.use.hasTouch, '터치 기기에서만 생기는 문제다');
    const id = await createTrip(page, {
      title: '선택 닫기',
      start: '2026-05-01',
      end: '2026-05-02',
      regions: ['강릉시'],
    });
    await page.goto(`/trips/${id}/expenses`);
    await page.getByTestId('add-expense').click();
    const select = page.locator('#expense-link');
    const box = (await select.boundingBox())!;
    const tap = () => page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    const isOpen = async () => (await select.getAttribute('aria-expanded')) === 'true';
    await tap();
    await expect.poll(isOpen).toBe(true);
    await tap();
    await expect.poll(isOpen).toBe(false);
  });

  test('주소로 바로 들어가도 화면이 열린다', async ({ page }) => {
    const id = await createTrip(page, {
      title: '정산 직접 진입',
      start: '2026-05-01',
      end: '2026-05-02',
      regions: ['강릉시'],
    });

    await page.goto(`/trips/${id}/expenses`);
    await expect(page.getByTestId('panel-expenses')).toBeVisible();
  });

  test('정산 탭을 왕복해도 작성 중인 지출 입력을 보존한다', async ({ page }) => {
    const id = await createTrip(page, {
      title: '입력 보존',
      start: '2026-05-01',
      end: '2026-05-02',
      regions: ['강릉시'],
    });

    await page.goto(`/trips/${id}/expenses`);
    await page.getByTestId('add-expense').click();
    await page.getByLabel('지출명', { exact: true }).fill('첫날 저녁');
    await page.getByLabel('실제 금액 (원)', { exact: true }).fill('12345');
    await page.getByRole('tab', { name: '정산 현황' }).click();
    await page.getByRole('tab', { name: '지출 내역' }).click();

    await expect(page.getByLabel('지출명', { exact: true })).toHaveValue('첫날 저녁');
    await expect(page.getByLabel('실제 금액 (원)', { exact: true })).toHaveValue('12345');
  });

  test('360px에서 지출 날짜와 분류 필드는 세로로 배치한다', async ({ page }) => {
    const id = await createTrip(page, {
      title: '좁은 화면',
      start: '2026-05-01',
      end: '2026-05-02',
      regions: ['강릉시'],
    });

    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`/trips/${id}/expenses`);
    await page.getByTestId('add-expense').click();
    const date = page.getByLabel('지출 날짜', { exact: true });
    const category = page.getByLabel('분류', { exact: true });
    const [dateBox, categoryBox] = await Promise.all([date.boundingBox(), category.boundingBox()]);
    expect(dateBox).not.toBeNull();
    expect(categoryBox).not.toBeNull();
    expect(Math.abs(dateBox!.y - categoryBox!.y)).toBeGreaterThanOrEqual(40);
  });

  test('균등 분담 지출의 금액을 고치면 분담도 새 금액으로 다시 나뉜다', async ({ page }) => {
    const id = await createTrip(page, {
      title: '금액 수정',
      start: '2026-05-01',
      end: '2026-05-02',
      regions: ['강릉시'],
    });
    const ledger = {
      people: [
        { id: 'self', name: '나' },
        { id: 'a', name: '민지' },
      ],
      expenses: [
        {
          id: 'e1',
          title: '저녁',
          date: '2026-05-01',
          category: 'food',
          amount: 20000,
          paidBy: 'self',
          splits: [
            { personId: 'self', amount: 10000 },
            { personId: 'a', amount: 10000 },
          ],
          memo: '',
          linkId: null,
        },
      ],
      receipts: [],
      budget: null,
    };
    await page.evaluate(
      ([key, value]) => localStorage.setItem(key, value),
      [`${STORAGE_KEY}.ledger.${id}`, JSON.stringify(ledger)],
    );
    await page.goto(`/trips/${id}/expenses`);
    await page.getByTestId('expense-menu-e1').click();
    await page.getByRole('menuitem', { name: '수정' }).click();

    // 전에는 균등 분담도 직접 입력 모드로 열려 이전 분담액 10,000원이 남았다.
    await expect(page.getByLabel('분담 금액 직접 입력')).not.toBeChecked();
    await page.getByLabel('실제 금액 (원)', { exact: true }).fill('30000');
    await page.getByRole('button', { name: '지출 저장' }).click();

    await page.getByRole('tab', { name: '정산 현황' }).click();
    await expect(page.getByTestId('panel-settlement')).toContainText('15,000원');
  });

  test('직접 입력한 분담은 금액과 합계가 어긋나면 바로 보인다', async ({ page }) => {
    const id = await createTrip(page, {
      title: '직접 분담',
      start: '2026-05-01',
      end: '2026-05-02',
      regions: ['강릉시'],
    });
    const ledger = {
      people: [
        { id: 'self', name: '나' },
        { id: 'a', name: '민지' },
      ],
      expenses: [
        {
          id: 'e1',
          title: '저녁',
          date: '2026-05-01',
          category: 'food',
          amount: 20000,
          paidBy: 'self',
          splits: [
            { personId: 'self', amount: 14000 },
            { personId: 'a', amount: 6000 },
          ],
          memo: '',
          linkId: null,
        },
      ],
      receipts: [],
      budget: null,
    };
    await page.evaluate(
      ([key, value]) => localStorage.setItem(key, value),
      [`${STORAGE_KEY}.ledger.${id}`, JSON.stringify(ledger)],
    );
    await page.goto(`/trips/${id}/expenses`);
    await page.getByTestId('expense-menu-e1').click();
    await page.getByRole('menuitem', { name: '수정' }).click();

    await expect(page.getByLabel('분담 금액 직접 입력')).toBeChecked();
    await page.getByLabel('실제 금액 (원)', { exact: true }).fill('30000');
    await expect(page.getByTestId('share-total')).toHaveText(/분담 합계 20,000원 \/ 지출\s+30,000원/);
  });

  test('직접 입력 중 전체 해제 후 다시 전체 선택하면 지출만큼 다시 나뉜다', async ({ page }) => {
    const id = await createTrip(page, {
      title: '다시 나누기',
      start: '2026-05-01',
      end: '2026-05-02',
      regions: ['강릉시'],
    });
    await page.evaluate(
      ([key, value]) => localStorage.setItem(key, value),
      [
        `${STORAGE_KEY}.ledger.${id}`,
        JSON.stringify({
          people: [
            { id: 'self', name: '나' },
            { id: 'a', name: '민지' },
          ],
          expenses: [],
          receipts: [],
          budget: null,
        }),
      ],
    );
    await page.goto(`/trips/${id}/expenses`);
    await page.getByTestId('add-expense').click();
    await page.getByLabel('지출명', { exact: true }).fill('저녁');
    await page.getByLabel('실제 금액 (원)', { exact: true }).fill('30000');
    await page.getByLabel('분담 금액 직접 입력').check();
    await expect(page.getByTestId('share-total')).toHaveText(/분담 합계 30,000원/);

    await page.getByTestId('expense-select-all').uncheck();
    await page.getByTestId('expense-select-all').check();
    await expect(page.getByTestId('share-total')).toHaveText(/분담 합계 30,000원 \/ 지출\s+30,000원/);
    await expect(page.getByLabel('민지 분담 금액')).toHaveValue('15000');
  });

  test('정산 내용을 이름과 금액이 담긴 글로 복사한다', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const id = await createTrip(page, {
      title: '복사 확인',
      start: '2026-05-01',
      end: '2026-05-02',
      regions: ['강릉시'],
    });
    const ledger = {
      people: [
        { id: 'me', name: '미현' },
        { id: 'a', name: '민지' },
      ],
      expenses: [
        {
          id: 'e1',
          title: '저녁',
          date: '2026-05-01',
          category: 'food',
          amount: 20000,
          paidBy: 'me',
          splits: [
            { personId: 'me', amount: 10000 },
            { personId: 'a', amount: 10000 },
          ],
          memo: '',
          linkId: null,
        },
      ],
      receipts: [],
      budget: null,
    };
    await page.evaluate(
      ([key, value]) => localStorage.setItem(key, value),
      [`${STORAGE_KEY}.ledger.${id}`, JSON.stringify(ledger)],
    );

    await page.goto(`/trips/${id}/expenses`);
    await page.getByRole('tab', { name: '정산 현황' }).click();
    await page.getByTestId('copy-settlement').click();

    await expect(page.getByTestId('success-toast')).toContainText('복사했어요');
    // Windows 클립보드는 줄바꿈을 CRLF로 바꿔 돌려준다.
    const text = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
    expect(text).toBe(['총금액 20,000원', '민지 → 미현 10,000원'].join('\n'));
  });
});
