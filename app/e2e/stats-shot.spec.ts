import { test } from '@playwright/test';
import { addStop, createTrip, resetApp } from './helpers';

/** 화면 모양 확인용. 여러 지역에 서로 다른 횟수를 넣어 높이 차이를 본다. */
const SEARCH_NAME: Record<string, string> = {
  서울: '종로구',
  강릉: '강릉시',
  부산: '해운대구',
  제주: '제주시',
  경주: '경주시',
  전주: '전주시',
};

test('통계 지도 모양을 찍는다', async ({ page }) => {
  // 검사가 아니라 지도 모양을 output에 남기는 캡처 스크립트다. 3D 지도(WebGL)는
  // 창 없는 테스트 브라우저에서 그려지지 않을 수 있어 필요할 때만 켠다: STATS_SHOT=1.
  test.skip(!process.env['STATS_SHOT'], '캡처가 필요할 때 STATS_SHOT=1로 실행한다');
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
      // 지역 검색은 시·군·구 단위다. 표에는 사람이 읽는 이름을 두고 검색 이름으로 바꾼다.
      regions: [SEARCH_NAME[region] ?? region],
    });
    for (const [i, address] of addresses.entries()) {
      await addStop(page, id, { name: `${region}장소${i}`, address, date: '2024-05-01' });
    }
  }

  await page.goto('/stats');
  await page.waitForSelector('canvas');
  await page.screenshot({ path: '../output/stats-country.png', fullPage: true });

  // 서울 자치구를 고른 모습도 본다. 목록은 처음부터 시·군·구 단위다.
  await page.goto('/stats/details');
  await page.getByTestId('block-map-list').getByRole('button', { name: /강남구/ }).click();
  await page.waitForSelector('[data-testid="block-map"]');
  await page.screenshot({ path: '../output/stats-seoul.png', fullPage: true });
});
