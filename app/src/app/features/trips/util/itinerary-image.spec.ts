import { expect, it } from 'vitest';
import { createTrip, createStop } from './factories';
import { itinerarySections, itineraryFilename } from './itinerary-image';

it('출력 모델에서 메모와 제외 항목을 빼고 날짜별로 필터링한다', () => {
  const trip = createTrip({
    startDate: '2026-09-14',
    endDate: '2026-09-15',
    stops: [
      createStop({ name: '바다', date: '2026-09-14', memo: '개인 메모', estimatedCost: 10000 }),
      createStop({ name: '숨김', excluded: true }),
    ],
  });
  const sections = itinerarySections(trip, '2026-09-14');
  expect(sections).toHaveLength(1);
  expect(sections[0]!.rows).toHaveLength(1);
  expect(JSON.stringify(sections)).not.toContain('개인 메모');
  expect(sections[0]!.rows[0]!.cost).toBe(10000);
  expect(itineraryFilename('강릉/속초: 여행', '')).toBe('강릉속초 여행_전체일정.png');
});
