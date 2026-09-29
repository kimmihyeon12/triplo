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

    await expect(page.getByTestId('copy-status')).toContainText('복사했어요');
    // Windows 클립보드는 줄바꿈을 CRLF로 바꿔 돌려준다.
    const text = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
    expect(text).toBe(['총금액 20,000원', '민지 → 미현 10,000원'].join('\n'));
  });
});
