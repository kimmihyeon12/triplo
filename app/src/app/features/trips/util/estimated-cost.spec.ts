import { expect, it } from 'vitest';
import { createStop, createStay, createTrip } from './factories';
import { estimatedCosts } from './estimated-cost';

it('미정과 0원을 구분하고 제외 장소를 빼며 숙박 전체 금액은 한 번 합산한다', () => {
  const trip = createTrip({
    stops: [
      createStop({ estimatedCost: 0 }),
      createStop({}),
      createStop({ estimatedCost: 9000, excluded: true }),
    ],
    stays: [createStay({ checkIn: '2026-09-14', checkOut: '2026-09-17', estimatedCost: 180000 })],
  });
  expect(estimatedCosts(trip)).toEqual({ total: 180000, unknown: 1 });
});
