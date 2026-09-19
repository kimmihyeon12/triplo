import { test } from '@playwright/test';
import { addStop, createTrip, resetApp } from './helpers';

/** 화면 모양 확인용. 여러 지역에 서로 다른 횟수를 넣어 높이 차이를 본다. */
test('통계 지도 모양을 찍는다', async ({ page }) => {
  await resetApp(page);

  const plan: [string, string[]][] = [
    ['서울', ['서울 강남구 삼성동 1', '서울 강남구 역삼동 2', '서울 마포구 서교동 3', '서울 종로구 세종로 4']],
    ['강릉', ['강원 강릉시 창해로 1', '강원 강릉시 경포로 2']],
    ['부산', ['부산 해운대구 우동 1', '부산 중구 남포동 2', '부산 수영구 광안동 3']],
    ['제주', ['제주 제주시 연동 1']],
    ['경주', ['경북 경주시 첨성로 1', '경북 경주시 불국로 2']],
    ['전주', ['전북 전주시 기린대로 1']],
  ];

  for (const [region, addresses] of plan) {
    const id = await createTrip(page, {
      title: `${region} 여행`,
      start: '2024-05-01',
      end: '2024-05-03',
      regions: [region],
    });
    for (const [i, address] of addresses.entries()) {
      await addStop(page, id, { name: `${region}장소${i}`, address, date: '2024-05-01' });
    }
  }

  await page.goto('/stats');
  await page.waitForSelector('canvas');
  await page.screenshot({ path: '../output/stats-country.png', fullPage: true });

  // 서울 안으로 들어간 모습도 본다.
  await page.goto('/stats/details');
  await page.getByTestId('block-map-list').getByRole('button', { name: /서울/ }).click();
  await page.waitForSelector('[data-testid="block-map"]');
  await page.screenshot({ path: '../output/stats-seoul.png', fullPage: true });
});
