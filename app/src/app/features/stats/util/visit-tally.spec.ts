import { describe, expect, it } from 'vitest';
import { createRegion, createStay, createStop, createTrip } from '../../trips/util/factories';
import type { Trip } from '../../trips/model/trip';
import { UNCLASSIFIED, tallyDistricts, tallyVisits, visitedPlacesIn } from './visit-tally';

const TODAY = '2026-09-18';

/** 종료일이 지난 여행 하나. 기본은 강릉에 장소 한 곳. */
function pastTrip(partial: Partial<Trip> = {}): Trip {
  const region = createRegion('강릉', 0, 'r1');
  return createTrip({
    title: '강릉 여행',
    startDate: '2026-08-01',
    endDate: '2026-08-03',
    regions: [region],
    stops: [createStop({ name: '안목해변', regionId: 'r1', date: '2026-08-01' })],
    ...partial,
  });
}

describe('tallyVisits', () => {
  it('종료일이 지난 여행의 장소를 센다', () => {
    const result = tallyVisits([pastTrip()], TODAY);
    // 지도가 시·군·구 단위이므로 '강릉'은 '강릉시'로 센다.
    expect(result.regions).toEqual([{ regionCode: '51_강릉시', name: '강릉시', visitCount: 1 }]);
    expect(result.totalPlaces).toBe(1);
  });

  it('종료일이 오늘 이후면 세지 않는다', () => {
    const future = pastTrip({ startDate: '2026-10-01', endDate: '2026-10-03' });
    expect(tallyVisits([future], TODAY).regions).toEqual([]);
  });

  it('종료일이 오늘이면 아직 세지 않는다', () => {
    // 여행이 오늘 끝난다면 아직 진행 중이다. 지난 뒤에 센다.
    const today = pastTrip({ startDate: TODAY, endDate: TODAY });
    expect(tallyVisits([today], TODAY).regions).toEqual([]);
  });

  it('종료일이 없으면 세지 않는다', () => {
    const undated = pastTrip({ startDate: null, endDate: null });
    expect(tallyVisits([undated], TODAY).regions).toEqual([]);
  });

  it('일정에서 제외한 장소는 세지 않는다', () => {
    const trip = pastTrip({
      stops: [createStop({ name: '안목해변', regionId: 'r1', excluded: true })],
    });
    expect(tallyVisits([trip], TODAY).regions).toEqual([]);
  });

  it('여유시간은 장소가 아니므로 세지 않는다', () => {
    const trip = pastTrip({
      stops: [createStop({ kind: 'buffer', regionId: 'r1' })],
    });
    expect(tallyVisits([trip], TODAY).regions).toEqual([]);
  });

  it('숙소도 방문으로 센다', () => {
    const trip = pastTrip({
      stops: [],
      stays: [
        createStay({ name: '강릉호텔', regionId: 'r1', checkIn: '2026-08-01', checkOut: '2026-08-02' }),
      ],
    });
    expect(tallyVisits([trip], TODAY).regions[0].visitCount).toBe(1);
  });

  it('좌표가 없는 장소도 지역 횟수에 넣는다', () => {
    const trip = pastTrip({
      stops: [createStop({ name: '이름만 적은 곳', regionId: 'r1' })],
    });
    expect(tallyVisits([trip], TODAY).regions[0].visitCount).toBe(1);
  });

  /*
    '광주 주말 여행'에 구례와 함평을 담은 경우다. 세 장소가 모두 여행 지역
    '광주'를 가리키므로, 여행 지역을 먼저 쓰면 전남 방문이 광주로 집계되어
    전남에 색이 칠해지지 않았다(2026-09-22 확인).
  */
  it('한 여행에 여러 시·도가 있으면 주소대로 나눠 센다', () => {
    const trip = createTrip({
      title: '광주 주말 여행',
      startDate: '2026-08-15',
      endDate: '2026-08-17',
      regions: [createRegion('광주', 0, 'g1')],
      stops: [
        createStop({ name: '국립아시아문화전당', regionId: 'g1', address: '광주광역시 동구 문화전당로 38' }),
        createStop({ name: '화엄사', regionId: 'g1', address: '전라남도 구례군 마산면 화엄사로 539' }),
        createStop({ name: '함평자연생태공원', regionId: 'g1', address: '전라남도 함평군 대동면 학야리' }),
      ],
    });
    const result = tallyVisits([trip], TODAY);
    expect(result.regions).toEqual([
      { regionCode: '12_구례군', name: '구례군', visitCount: 1 },
      { regionCode: '12_동구', name: '동구(전남광주)', visitCount: 1 },
      { regionCode: '12_함평군', name: '함평군', visitCount: 1 },
    ]);
  });

  it('같은 지역을 여러 여행에서 방문하면 합쳐 센다', () => {
    const first = pastTrip();
    const second = pastTrip({
      stops: [
        createStop({ name: '경포대', regionId: 'r1' }),
        createStop({ name: '오죽헌', regionId: 'r1' }),
      ],
    });
    const result = tallyVisits([first, second], TODAY);
    expect(result.regions).toEqual([{ regionCode: '51_강릉시', name: '강릉시', visitCount: 3 }]);
  });

  it('많이 방문한 지역을 앞에 둔다', () => {
    const gangneung = pastTrip();
    const jeju = createTrip({
      startDate: '2026-08-10',
      endDate: '2026-08-12',
      regions: [createRegion('제주', 0, 'j1')],
      stops: [
        createStop({ name: '성산일출봉', regionId: 'j1' }),
        createStop({ name: '한라산', regionId: 'j1' }),
      ],
    });
    const result = tallyVisits([gangneung, jeju], TODAY);
    expect(result.regions.map((r) => r.name)).toEqual(['제주시', '강릉시']);
  });

  it('코드가 없는 예전 여행은 이름으로 보정한다', () => {
    const trip = pastTrip({
      regions: [{ id: 'r1', name: '강릉', order: 0 }],
    });
    expect(tallyVisits([trip], TODAY).regions[0].regionCode).toBe('51_강릉시');
  });

  it('표준 목록에 없는 지역은 분류되지 않음으로 센다', () => {
    const trip = pastTrip({
      regions: [{ id: 'r1', name: '어딘가', order: 0 }],
    });
    const result = tallyVisits([trip], TODAY);
    expect(result.regions).toEqual([]);
    expect(result.unclassifiedCount).toBe(1);
  });

  it('지역이 지정되지 않은 장소도 분류되지 않음으로 센다', () => {
    const trip = pastTrip({
      stops: [createStop({ name: '어디였더라', regionId: null })],
    });
    const result = tallyVisits([trip], TODAY);
    expect(result.regions).toEqual([]);
    expect(result.unclassifiedCount).toBe(1);
  });

  it('분류되지 않은 장소도 총 개수에는 넣는다', () => {
    const trip = pastTrip({
      stops: [
        createStop({ name: '안목해변', regionId: 'r1' }),
        createStop({ name: '어디였더라', regionId: null }),
      ],
    });
    const result = tallyVisits([trip], TODAY);
    expect(result.totalPlaces).toBe(2);
    expect(result.unclassifiedCount).toBe(1);
  });

  it('여행이 없으면 빈 결과를 낸다', () => {
    const result = tallyVisits([], TODAY);
    expect(result.regions).toEqual([]);
    expect(result.totalPlaces).toBe(0);
    expect(result.unclassifiedCount).toBe(0);
  });

  it('분류되지 않음 키는 지역 코드와 겹치지 않는다', () => {
    expect(UNCLASSIFIED).not.toMatch(/^[a-z]+-[a-z]+$/);
  });

  /*
    같은 강원이라도 강릉과 속초는 다른 시다. 예전에는 둘 다 '강원' 한 줄로
    묶여 어디를 다녀왔는지 알 수 없었다(2026-09-22 결정).
  */
  it('같은 시·도라도 시·군·구가 다르면 따로 센다', () => {
    const gangneung = pastTrip();
    const sokcho = createTrip({
      startDate: '2026-08-10',
      endDate: '2026-08-12',
      regions: [createRegion('속초', 0, 's1')],
      stops: [createStop({ name: '영금정', regionId: 's1' })],
    });
    const result = tallyVisits([gangneung, sokcho], TODAY);
    expect(result.regions.map((r) => r.regionCode).sort()).toEqual(['51_강릉시', '51_속초시']);
  });

  it('이름은 행정구역 이름을 쓴다', () => {
    const trip = createTrip({
      startDate: '2026-08-01',
      endDate: '2026-08-03',
      regions: [createRegion('수원', 0, 'r1')],
      stops: [createStop({ regionId: 'r1' })],
    });
    expect(tallyVisits([trip], TODAY).regions[0].name).toBe('수원시');
  });

  // 같은 이름이 여러 시·도에 있으면 시·도를 괄호로 덧붙여 구분한다.
  it('겹치는 이름에는 시·도를 덧붙인다', () => {
    const trip = createTrip({
      startDate: '2026-08-01',
      endDate: '2026-08-03',
      regions: [createRegion('서울', 0, 'r1')],
      stops: [createStop({ address: '서울특별시 중구 세종대로 110', regionId: 'r1' })],
    });
    expect(tallyVisits([trip], TODAY).regions[0].name).toBe('중구(서울)');
  });
});

describe('tallyDistricts', () => {
  /** 서울 여행 하나. 주소로 자치구를 판별한다. */
  function seoulTrip(addresses: string[]): Trip {
    return createTrip({
      title: '서울 여행',
      startDate: '2026-08-01',
      endDate: '2026-08-03',
      regions: [createRegion('서울', 0, 'r1')],
      stops: addresses.map((address, i) =>
        createStop({ name: `장소${i}`, address, regionId: 'r1' }),
      ),
    });
  }

  it('주소에서 자치구를 읽어 센다', () => {
    const trip = seoulTrip(['서울 강남구 역삼동 1', '서울 강남구 삼성동 2', '서울 마포구 서교동 3']);
    const result = tallyDistricts([trip], TODAY, '11');
    expect(result.regions).toEqual([
      { regionCode: '11_강남구', name: '강남구', visitCount: 2 },
      { regionCode: '11_마포구', name: '마포구', visitCount: 1 },
    ]);
  });

  /*
    주소가 없으면 여행 지역으로 되돌아간다. '서울'은 시·도 이름이라 그
    시·도의 지역 하나로 읽히며, 어느 자치구인지까지는 알 수 없다.
  */
  it('주소가 없으면 여행 지역으로 센다', () => {
    const trip = seoulTrip(['']);
    const result = tallyDistricts([trip], TODAY, '11');
    expect(result.regions).toHaveLength(1);
    expect(result.regions[0].regionCode.startsWith('11_')).toBe(true);
  });

  it('선택한 시·도 밖의 장소는 세지 않는다', () => {
    const trip = createTrip({
      startDate: '2026-08-01',
      endDate: '2026-08-03',
      regions: [createRegion('강릉', 0, 'r1')],
      stops: [createStop({ name: '안목해변', address: '강원 강릉시 창해로 1', regionId: 'r1' })],
    });
    // totalPlaces는 훑어본 항목 수이고, 고른 시·도 밖이면 regions가 빈다.
    const result = tallyDistricts([trip], TODAY, '11');
    expect(result.regions).toEqual([]);
  });

  it('종료일이 지나지 않은 여행은 세지 않는다', () => {
    const trip = createTrip({
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      regions: [createRegion('서울', 0, 'r1')],
      stops: [createStop({ address: '서울 강남구 역삼동 1', regionId: 'r1' })],
    });
    expect(tallyDistricts([trip], TODAY, '11').regions).toEqual([]);
  });

  // 이제 모든 시·도가 시·군·구로 나뉜다. 서울만 하위 단위가 있던 때와 다르다.
  it('서울이 아닌 시·도도 시·군·구로 센다', () => {
    const trip = createTrip({
      startDate: '2026-08-01',
      endDate: '2026-08-03',
      regions: [createRegion('강릉', 0, 'r1')],
      stops: [createStop({ address: '강원 강릉시 창해로 1', regionId: 'r1' })],
    });
    expect(tallyDistricts([trip], TODAY, '51').regions).toEqual([
      { regionCode: '51_강릉시', name: '강릉시', visitCount: 1 },
    ]);
  });
});

describe('visitedPlacesIn', () => {
  it('filters by saved itinerary kind without guessing categories from names', () => {
    const trip = pastTrip({ stops: [
      createStop({ name: '카페라고 적은 일반 장소', kind: 'place', regionId: 'r1' }),
      createStop({ name: '식사', kind: 'meal', regionId: 'r1' }),
      createStop({ name: '커피', kind: 'break', regionId: 'r1' }),
      createStop({ name: '제외 식사', kind: 'meal', regionId: 'r1', excluded: true }),
    ] });
    expect(tallyVisits([trip], TODAY, 'meal').totalPlaces).toBe(1);
    expect(visitedPlacesIn([trip], TODAY, '51', 'break').map(p => p.name)).toEqual(['커피']);
    expect(visitedPlacesIn([trip], TODAY, '51', 'travel').map(p => p.name)).toEqual(['카페라고 적은 일반 장소']);
  });
  it('지역의 방문 장소를 낸다', () => {
    const result = visitedPlacesIn([pastTrip()], TODAY, '51_강릉시');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: '안목해변',
      visitedOn: '2026-08-03',
      tripTitle: '강릉 여행',
    });
  });

  it('자치구 코드로도 찾는다', () => {
    const trip = createTrip({
      title: '서울 여행',
      startDate: '2026-08-01',
      endDate: '2026-08-03',
      regions: [createRegion('서울', 0, 'r1')],
      stops: [
        createStop({ name: '코엑스', address: '서울 강남구 삼성동 1', regionId: 'r1' }),
        createStop({ name: '홍대', address: '서울 마포구 서교동 1', regionId: 'r1' }),
      ],
    });
    const result = visitedPlacesIn([trip], TODAY, '11_강남구');
    expect(result.map((p) => p.name)).toEqual(['코엑스']);
  });

  it('좌표 없는 장소도 목록에 넣는다', () => {
    const result = visitedPlacesIn([pastTrip()], TODAY, '51_강릉시');
    expect(result[0].location).toBeNull();
  });

  it('최근 방문을 앞에 둔다', () => {
    const older = pastTrip({ endDate: '2026-07-01' });
    const newer = pastTrip({
      endDate: '2026-08-20',
      stops: [createStop({ name: '경포대', regionId: 'r1' })],
    });
    const result = visitedPlacesIn([older, newer], TODAY, '51_강릉시');
    expect(result.map((p) => p.name)).toEqual(['경포대', '안목해변']);
  });

  it('숙소도 목록에 넣는다', () => {
    const trip = pastTrip({
      stops: [],
      stays: [
        createStay({ name: '강릉호텔', regionId: 'r1', checkIn: '2026-08-01', checkOut: '2026-08-02' }),
      ],
    });
    expect(visitedPlacesIn([trip], TODAY, '51_강릉시').map((p) => p.name)).toEqual([
      '강릉호텔',
    ]);
  });

  it('없는 지역은 빈 목록을 낸다', () => {
    expect(visitedPlacesIn([pastTrip()], TODAY, 'jeju-jeju')).toEqual([]);
  });

  it('시·도 코드를 주면 그 도의 장소를 모두 낸다', () => {
    // 전국 지도가 시·도 단위로 묶으므로, 블록을 누르면 시·도 코드가 온다.
    const gangneung = pastTrip();
    const sokcho = createTrip({
      title: '속초 여행',
      startDate: '2026-08-10',
      endDate: '2026-08-12',
      regions: [createRegion('속초', 0, 's1')],
      stops: [createStop({ name: '영금정', regionId: 's1' })],
    });
    const result = visitedPlacesIn([gangneung, sokcho], TODAY, '51');
    expect(result.map((p) => p.name)).toEqual(['영금정', '안목해변']);
  });

  it('시·도 코드는 다른 도의 장소를 끌어오지 않는다', () => {
    const trip = createTrip({
      startDate: '2026-08-01',
      endDate: '2026-08-03',
      regions: [createRegion('경주', 0, 'r1')],
      stops: [createStop({ name: '첨성대', regionId: 'r1' })],
    });
    expect(visitedPlacesIn([trip, pastTrip()], TODAY, '51').map((p) => p.name)).toEqual([
      '안목해변',
    ]);
  });
});
