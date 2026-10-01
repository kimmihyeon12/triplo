import { describe, expect, it, vi } from 'vitest';
import {
  createResolvePlaceHandler,
  MAX_HOPS,
  type Hop,
} from '../../../../../../supabase/functions/resolve-place/handler';
import {
  linkProvider,
  placeIdFrom,
  readKakaoPlace,
  readNaverPlace,
} from '../../../../../../supabase/functions/resolve-place/place-link';

/** 2026-10-01 실제 네이버 모바일 장소 페이지에서 필요한 부분만 잘라 둔 것. */
const NAVER_ID = '2058177895';
const NAVER_PAGE =
  '<html><head><meta property="og:title" content="신가회전훠궈 수원역점 : 네이버"></head><body><script>window.__APOLLO_STATE__ = {' +
  '"PlaceDetailBase:1111111":{"__typename":"PlaceDetailBase","id":"1111111","name":"다른 가게","coordinate":{"x":"126.9","y":"37.5"}},' +
  `"PlaceDetailBase:${NAVER_ID}":{"__typename":"PlaceDetailBase","id":"${NAVER_ID}","name":"신가회전훠궈 수원역점",` +
  '"category":"중식당","roadAddress":"경기 수원시 팔달구 향교로 25-1 2층","address":"경기 수원시 팔달구 매산로2가 28-2",' +
  '"coordinate":{"__typename":"Coordinate","x":"127.0037697","y":"37.268625","mapZoomLevel":12}}};</script></body></html>';

/** 2026-10-01 실제 카카오 장소 정보(panel3)의 summary 부분. */
const KAKAO_ID = '14261688';
const KAKAO_JSON = {
  summary: {
    confirm_id: KAKAO_ID,
    name: '신가회전훠궈 수원역점',
    category: { name: '중식', name1: '음식점', name2: '중식' },
    point: { lon: 127.0037565852695, lat: 37.2686159151247 },
    address: { disp: '경기 수원시 팔달구 향교로 25-1 (매산로2가)', jibun: '매산로2가 28-2', road: '경기 수원시 팔달구 향교로 25-1' },
  },
};

describe('지도 링크 판별', () => {
  it.each([
    ['https://naver.me/5Qsr0ejg', 'naver'],
    ['https://map.naver.com/p/entry/place/2058177895?placePath=%2Fhome', 'naver'],
    ['https://m.place.naver.com/restaurant/2058177895/home', 'naver'],
    ['https://kko.to/abcdEF', 'kakao'],
    ['https://place.map.kakao.com/14261688', 'kakao'],
    ['https://map.kakao.com/?itemId=14261688', 'kakao'],
  ])('%s는 %s 링크다', (url, provider) => {
    expect(linkProvider(url)).toBe(provider);
  });

  it.each([
    'http://naver.me/5Qsr0ejg',
    'https://naver.me.evil.test/x',
    'https://evilnaver.me/x',
    'https://localhost/place/1',
    'https://169.254.169.254/latest',
    '지도 링크 아님',
  ])('%s는 받지 않는다', (url) => {
    expect(linkProvider(url)).toBeNull();
  });

  it('주소에서 장소 번호를 꺼낸다. 짧은 링크에는 번호가 없다', () => {
    expect(placeIdFrom('https://naver.me/5Qsr0ejg')).toBeNull();
    expect(placeIdFrom('https://map.naver.com/p/entry/place/2058177895?placePath=%2Fhome')).toBe(NAVER_ID);
    expect(placeIdFrom('https://m.place.naver.com/accommodation/2058177895/home')).toBe(NAVER_ID);
    expect(placeIdFrom('https://m.map.naver.com/?pinId=2058177895&pinType=site')).toBe(NAVER_ID);
    expect(placeIdFrom('https://kko.to/abcdEF')).toBeNull();
    expect(placeIdFrom('https://place.map.kakao.com/14261688')).toBe(KAKAO_ID);
    expect(placeIdFrom('https://map.kakao.com/?itemId=14261688')).toBe(KAKAO_ID);
  });
});

describe('제공자 응답에서 장소 읽기', () => {
  it('네이버 장소 페이지에서 그 번호의 이름·주소·분류·좌표를 읽는다', () => {
    expect(readNaverPlace(NAVER_PAGE, NAVER_ID)).toEqual({
      provider: 'naver',
      id: NAVER_ID,
      name: '신가회전훠궈 수원역점',
      roadAddress: '경기 수원시 팔달구 향교로 25-1 2층',
      address: '경기 수원시 팔달구 매산로2가 28-2',
      lat: 37.268625,
      lng: 127.0037697,
      category: '중식당',
      url: `https://m.place.naver.com/place/${NAVER_ID}/home`,
    });
  });

  it('카카오 장소 정보에서 읽고, 지번에 시·구를 붙인다', () => {
    expect(readKakaoPlace(KAKAO_JSON, KAKAO_ID)).toEqual({
      provider: 'kakao',
      id: KAKAO_ID,
      name: '신가회전훠궈 수원역점',
      roadAddress: '경기 수원시 팔달구 향교로 25-1',
      address: '경기 수원시 팔달구 매산로2가 28-2',
      lat: 37.2686159151247,
      lng: 127.0037565852695,
      category: '중식',
      url: `https://place.map.kakao.com/${KAKAO_ID}`,
    });
  });

  it('구조가 바뀌거나 좌표가 없으면 읽지 못한 것으로 본다', () => {
    expect(readNaverPlace('<html></html>', NAVER_ID)).toBeNull();
    expect(readNaverPlace(NAVER_PAGE.replace('"x":"127.0037697"', '"x":""'), NAVER_ID)).toBeNull();
    expect(readKakaoPlace({}, KAKAO_ID)).toBeNull();
    expect(readKakaoPlace({ summary: { name: 'x', point: { lat: 0, lon: 0 } } }, KAKAO_ID)).toBeNull();
  });
});

describe('resolve-place 함수', () => {
  const request = (url: unknown, token = 'good') =>
    new Request('https://edge/resolve-place', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    });

  function setup(hops: Record<string, Hop>) {
    const fetchOnce = vi.fn(async (url: string) => {
      const hop = hops[url];
      if (!hop) throw new Error('unexpected ' + url);
      return hop;
    });
    const handler = createResolvePlaceHandler({
      getUser: async (token) => (token === 'good' ? { id: 'u1' } : null),
      fetchOnce,
    });
    return { handler, fetchOnce };
  }

  const redirect = (location: string): Hop => ({ status: 307, location, body: '' });
  const page = (body: string): Hop => ({ status: 200, location: null, body });

  it('네이버 짧은 링크를 한 번 따라가 번호를 얻고 장소 페이지에서 읽는다', async () => {
    const { handler, fetchOnce } = setup({
      'https://naver.me/5Qsr0ejg': redirect(`https://map.naver.com/p/entry/place/${NAVER_ID}?placePath=%2Fhome`),
      [`https://m.place.naver.com/place/${NAVER_ID}/home`]: redirect(`/restaurant/${NAVER_ID}/home`),
      [`https://m.place.naver.com/restaurant/${NAVER_ID}/home`]: page(NAVER_PAGE),
    });
    const response = await handler(request('https://naver.me/5Qsr0ejg'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ provider: 'naver', id: NAVER_ID, lat: 37.268625, lng: 127.0037697 });
    expect(fetchOnce).toHaveBeenCalledTimes(3);
  });

  it('카카오 장소 주소는 따라가지 않고 장소 정보를 읽는다', async () => {
    const { handler } = setup({
      [`https://place-api.map.kakao.com/places/panel3/${KAKAO_ID}`]: page(JSON.stringify(KAKAO_JSON)),
    });
    const response = await handler(request(`https://place.map.kakao.com/${KAKAO_ID}`));
    expect(await response.json()).toMatchObject({ provider: 'kakao', id: KAKAO_ID, name: '신가회전훠궈 수원역점' });
  });

  it('리디렉션이 허용한 지도 밖으로 가면 따라가지 않는다', async () => {
    const { handler, fetchOnce } = setup({ 'https://naver.me/evil': redirect('http://169.254.169.254/latest/meta-data') });
    expect((await handler(request('https://naver.me/evil'))).status).toBe(404);
    expect(fetchOnce).toHaveBeenCalledTimes(1);
  });

  it(`리디렉션은 ${MAX_HOPS}번까지만 따라간다`, async () => {
    const hops: Record<string, Hop> = {};
    for (let i = 0; i < 10; i++) hops[`https://naver.me/l${i}`] = redirect(`https://naver.me/l${i + 1}`);
    const { handler, fetchOnce } = setup(hops);
    expect((await handler(request('https://naver.me/l0'))).status).toBe(404);
    expect(fetchOnce).toHaveBeenCalledTimes(MAX_HOPS);
  });

  it('네이버가 다른 번호의 페이지로 옮기면 읽지 않는다', async () => {
    const { handler } = setup({
      [`https://m.place.naver.com/place/${NAVER_ID}/home`]: redirect('/restaurant/999999/home'),
    });
    expect((await handler(request(`https://m.place.naver.com/place/${NAVER_ID}/home`))).status).toBe(404);
  });

  it('지도 링크가 아니면 400, 로그인하지 않으면 401, 제공자 오류는 502', async () => {
    const { handler } = setup({});
    expect((await handler(request('https://example.com/x'))).status).toBe(400);
    expect((await handler(request(`https://place.map.kakao.com/${KAKAO_ID}`, 'bad'))).status).toBe(401);
    expect((await handler(request(`https://place.map.kakao.com/${KAKAO_ID}`))).status).toBe(502);
  });
});
