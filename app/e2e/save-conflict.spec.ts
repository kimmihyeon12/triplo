import { expect, test, type Page } from '@playwright/test';
import { addStop, createTrip, resetApp, STORAGE_KEY } from './helpers';

/**
 * 다른 기기·탭에서 먼저 저장해 충돌이 난 뒤의 흐름. 테스트 앱은 기기 저장소를
 * 쓰므로 충돌 흉내 표시(CONFLICT_FLAG)로 서버의 P0409 거절을 재현한다.
 *
 * 코드 리뷰에서 잡힌 결함을 고정한다: 새로 불러오기가 스토어만 바꾸고 폼은
 * 옛 사본을 들고 있어, 그 상태로 저장하면 다른 기기에서 더한 장소가 지워졌다.
 */
const CONFLICT_FLAG = `${STORAGE_KEY}.conflictSave`;

interface StoredTrip {
  id: string;
  stops: { id: string; name: string }[];
}

async function readTrip(page: Page, id: string): Promise<StoredTrip> {
  return page.evaluate(
    ([key, tripId]) => JSON.parse(localStorage.getItem(key) ?? '{}').trips[tripId],
    [STORAGE_KEY, id],
  );
}

test.describe('저장 충돌', () => {
  test.beforeEach(async ({ page }) => resetApp(page));

  test('충돌 뒤 새로 불러오면 폼이 서버본으로 바뀌고, 다른 기기에서 더한 장소가 남는다', async ({
    page,
  }) => {
    const id = await createTrip(page, {
      title: '충돌 확인',
      start: '2026-05-01',
      end: '2026-05-02',
      regions: ['강릉시'],
    });
    await addStop(page, id, { name: '안목해변', date: '2026-05-01' });
    const stopId = (await readTrip(page, id)).stops[0].id;

    await page.goto(`/trips/${id}/stops/${stopId}`);
    await page.evaluate((flag) => localStorage.setItem(flag, '1'), CONFLICT_FLAG);
    await page.getByTestId('stop-name').fill('내가 고친 이름');
    await page.getByTestId('stop-save').click();
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'conflict');

    // 그사이 다른 기기가 장소를 하나 더했다.
    await page.evaluate(
      ([key, tripId]) => {
        const file = JSON.parse(localStorage.getItem(key)!);
        const trip = file.trips[tripId];
        trip.stops.push({ ...trip.stops[0], id: 'other-device-stop', name: '다른 기기 장소', order: 1 });
        localStorage.setItem(key, JSON.stringify(file));
      },
      [STORAGE_KEY, id],
    );
    await page.evaluate((flag) => localStorage.removeItem(flag), CONFLICT_FLAG);

    await page.getByTestId('reload-trip').click();
    await expect(page.getByTestId('stop-name')).toHaveValue('안목해변');
    await expect(page.getByTestId('save-status')).toHaveCount(0);

    await page.getByTestId('stop-name').fill('안목해변 커피거리');
    await page.getByTestId('stop-save').click();
    await expect(page).toHaveURL(new RegExp(`/trips/${id}(\\?|$)`));

    const names = (await readTrip(page, id)).stops.map((s) => s.name).sort();
    expect(names).toEqual(['다른 기기 장소', '안목해변 커피거리']);
  });
});
