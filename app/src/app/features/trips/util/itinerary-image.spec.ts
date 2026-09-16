import { expect, it } from 'vitest';
import { createTrip, createStop, createStay, createRegion } from './factories';
import {
  itinerarySections,
  itineraryFilename,
  itineraryTicket,
  sectionSummary,
} from './itinerary-image';

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

it('전부 접어 티켓만 저장하면 파일 이름으로 구분한다', () => {
  expect(itineraryFilename('부산 여행', '', true)).toBe('부산 여행_티켓.png');
  expect(itineraryFilename('부산 여행', '2026-10-02', true)).toBe('부산 여행_티켓.png');
});

it('숙소 줄은 주소가 없으면 구분점을 남기지 않는다', () => {
  const trip = createTrip({
    startDate: '2026-10-02',
    endDate: '2026-10-03',
    stays: [createStay({ name: '호텔', checkIn: '2026-10-02', checkOut: '2026-10-04' })],
  });
  const [day1] = itinerarySections(trip);
  expect(day1!.rows[0]!.detail).toBe('2026.10.02(금) ~ 2026.10.04(일)');
});

it('숙소 줄에 주소가 있으면 날짜 뒤에 붙인다', () => {
  const trip = createTrip({
    startDate: '2026-10-02',
    endDate: '2026-10-03',
    stays: [
      createStay({
        name: '호텔',
        address: '부산 해운대구',
        checkIn: '2026-10-02',
        checkOut: '2026-10-04',
      }),
    ],
  });
  const [day1] = itinerarySections(trip);
  expect(day1!.rows[0]!.detail).toBe('2026.10.02(금) ~ 2026.10.04(일) · 부산 해운대구');
});

it('날짜마다 항목 수와 비용 합계를 함께 낸다', () => {
  const trip = createTrip({
    startDate: '2026-09-14',
    endDate: '2026-09-16',
    stops: [
      createStop({ name: '바다', date: '2026-09-14', estimatedCost: 10000 }),
      createStop({ name: '시장', date: '2026-09-14', estimatedCost: 5000 }),
      createStop({ name: '전망대', date: '2026-09-14' }),
      createStop({ name: '카페', date: '2026-09-15' }),
    ],
    stays: [createStay({ name: '호텔', checkIn: '2026-09-14', checkOut: '2026-09-15' })],
  });
  const [day1, day2, day3] = itinerarySections(trip);
  expect(day1!.placeCount).toBe(4);
  expect(day1!.totalCost).toBe(15000);
  expect(day2!.placeCount).toBe(1);
  // 비용을 하나도 적지 않은 날은 합계를 0원이 아니라 미정으로 둔다.
  expect(day2!.totalCost).toBeNull();
  expect(day3!.placeCount).toBe(0);
  expect(day3!.totalCost).toBeNull();
});

it('접은 날짜 요약은 항목 수를 적고 비용은 켠 경우에만 붙인다', () => {
  const trip = createTrip({
    startDate: '2026-09-14',
    endDate: '2026-09-14',
    stops: [createStop({ name: '바다', date: '2026-09-14', estimatedCost: 12000 })],
  });
  const [day1] = itinerarySections(trip);
  expect(sectionSummary(day1!, false)).toBe('장소 1곳');
  expect(sectionSummary(day1!, true)).toBe('장소 1곳 · 예상 12,000원');
  const empty = { key: 'x', title: 'x', rows: [], placeCount: 0, totalCost: null };
  expect(sectionSummary(empty, true)).toBe('등록한 일정 없음');
});

it('티켓 머리글에 기간과 지역과 티켓 번호를 담는다', () => {
  const trip = createTrip({
    id: '9cd40e7d-8268-4e8a-a6c1-27aea4a8caae',
    title: '부산 여행',
    startDate: '2026-10-02',
    endDate: '2026-10-04',
    regions: [createRegion('부산', 0), createRegion('경주', 1)],
  });
  const ticket = itineraryTicket(trip);
  expect(ticket.title).toBe('부산 여행');
  // 연도까지 적어 나중에 다시 봐도 언제 간 여행인지 알 수 있게 한다.
  expect(ticket.date).toBe('2026.10.02(금)');
  expect(ticket.dateEnd).toBe('2026.10.04(일)');
  expect(ticket.period).toBe('2박 3일');
  expect(ticket.region).toBe('부산 · 경주');
  expect(ticket.no).toMatch(/^TR-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
});

it('티켓에 담은 장소 수를 낸다', () => {
  const trip = createTrip({
    startDate: '2026-10-02',
    endDate: '2026-10-03',
    stops: [
      createStop({ name: '바다', date: '2026-10-02' }),
      createStop({ name: '시장', date: '2026-10-02' }),
      createStop({ name: '뺀 곳', excluded: true }),
    ],
    stays: [createStay({ name: '호텔', checkIn: '2026-10-02', checkOut: '2026-10-03' })],
  });
  // 제외한 장소는 세지 않고, 숙소는 장소와 따로 센다.
  expect(itineraryTicket(trip).schedule).toBe('2곳 방문 · 숙소 1곳');
});

it('장소가 없으면 일정 칸을 자유 일정으로 둔다', () => {
  expect(itineraryTicket(createTrip({})).schedule).toBe('자유 일정');
});

it('첫 지역에서 마지막 지역으로 가는 흐름을 낸다', () => {
  const trip = createTrip({
    regions: [createRegion('부산', 0), createRegion('통영', 1), createRegion('여수', 2)],
  });
  const ticket = itineraryTicket(trip);
  expect(ticket.from).toBe('부산');
  expect(ticket.to).toBe('여수');
});

it('지역이 하나면 출발지와 도착지를 같게 둔다', () => {
  const ticket = itineraryTicket(createTrip({ regions: [createRegion('제주', 0)] }));
  expect(ticket.from).toBe('제주');
  expect(ticket.to).toBe('제주');
});

it('당일 여행은 끝 날짜를 비워 한 줄로 적는다', () => {
  const ticket = itineraryTicket(
    createTrip({ startDate: '2026-03-05', endDate: '2026-03-05' }),
  );
  expect(ticket.date).toBe('2026.03.05(목)');
  expect(ticket.dateEnd).toBe('');
  expect(ticket.period).toBe('0박 1일');
});

it('날짜와 지역을 정하지 않은 여행도 티켓 머리글을 만든다', () => {
  const ticket = itineraryTicket(createTrip({ title: '미정 여행' }));
  expect(ticket.date).toBe('날짜 미정');
  expect(ticket.dateEnd).toBe('');
  expect(ticket.period).toBe('기간 미정');
  expect(ticket.region).toBe('지역 미정');
  expect(ticket.from).toBe('어딘가');
  expect(ticket.to).toBe('어딘가');
});
