import {
  linkProvider,
  placeIdFrom,
  readKakaoPlace,
  readNaverPlace,
  sourceUrl,
  type LinkProvider,
  type LinkedPlace,
} from './place-link.ts';

/**
 * 네이버·카카오 지도 링크에서 장소(이름·주소·좌표·분류)를 읽는다(2026-10-01).
 * 설계: docs/superpowers/specs/2026-10-01-place-link-import-design.md
 *
 * 브라우저는 다른 사이트의 요청을 막는 제공자를 직접 부를 수 없어 이 함수를 거친다.
 * 앱은 먼저 카카오 검색에서 같은 장소를 찾고, 없을 때만 이 값으로 담는다.
 */

/** 한 번 요청한 결과. 리디렉션이면 location에 다음 주소가 온다. 따라가지는 않는다. */
export interface Hop {
  status: number;
  location: string | null;
  body: string;
}

export interface ResolvePlaceDeps {
  /** 토큰을 검증해 사용자를 돌려준다. 실패하면 null. */
  getUser(token: string): Promise<{ id: string } | null>;
  /** 주소 하나를 요청한다. 리디렉션은 따라가지 않는다. 실패하면 던진다. */
  fetchOnce(url: string, provider: LinkProvider): Promise<Hop>;
}

/** 짧은 링크를 따라가는 최대 횟수. */
export const MAX_HOPS = 4;

export function createResolvePlaceHandler(deps: ResolvePlaceDeps) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
  const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });

  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });

    // 로그인한 사람만 쓴다. 아무나 부르면 우리 서버가 남의 요청을 대신 보내는 통로가 된다.
    const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
    if (!token) return reply(401, { error: 'authentication_required' });
    const user = await deps.getUser(token);
    if (!user) return reply(401, { error: 'authentication_required' });

    const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!url || !linkProvider(url)) return reply(400, { error: 'unsupported_url' });

    try {
      const place = await resolve(deps, url);
      return place ? reply(200, place) : reply(404, { error: 'place_not_found' });
    } catch {
      return reply(502, { error: 'upstream_failed' });
    }
  };
}

/** 장소 번호를 얻을 때까지 한 번씩 따라가고, 번호를 얻으면 정해진 주소에서 장소를 읽는다. */
async function resolve(deps: ResolvePlaceDeps, start: string): Promise<LinkedPlace | null> {
  let url = start;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const provider = linkProvider(url);
    // 허용한 지도 호스트를 벗어나면 중단한다(SSRF).
    if (!provider) return null;
    const id = placeIdFrom(url);
    if (id) return read(deps, provider, id);
    if (hop === MAX_HOPS) return null;
    const next = await deps.fetchOnce(url, provider);
    if (!next.location || next.status < 300 || next.status >= 400) return null;
    url = new URL(next.location, url).toString();
  }
  return null;
}

async function read(deps: ResolvePlaceDeps, provider: LinkProvider, id: string): Promise<LinkedPlace | null> {
  const page = await deps.fetchOnce(sourceUrl(provider, id), provider);
  if (provider === 'kakao') {
    if (page.status !== 200) return page.status === 404 ? null : Promise.reject(new Error('kakao ' + page.status));
    return readKakaoPlace(JSON.parse(page.body), id);
  }
  // 네이버는 업종에 맞는 경로(/restaurant/ 등)로 한 번 옮긴다. 같은 번호의 장소 페이지만 따라간다.
  if (page.status >= 300 && page.status < 400 && page.location) {
    const next = new URL(page.location, sourceUrl(provider, id)).toString();
    if (linkProvider(next) !== 'naver' || placeIdFrom(next) !== id) return null;
    const moved = await deps.fetchOnce(next, provider);
    return moved.status === 200 ? readNaverPlace(moved.body, id) : null;
  }
  return page.status === 200 ? readNaverPlace(page.body, id) : null;
}
