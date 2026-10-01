/**
 * 네이버·카카오 지도 링크를 알아보고, 장소 번호를 꺼내고, 제공자 응답에서 장소를 읽는다(2026-10-01).
 * 설계: docs/superpowers/specs/2026-10-01-place-link-import-design.md
 *
 * 서버(resolve-place)와 앱이 같은 규칙을 쓴다. 앱이 미리 걸러 헛된 호출을 줄이고, 서버는 같은 검사를 다시 한다.
 * 서버만 믿으면 앱이 아무 주소나 보내고, 앱만 믿으면 서버가 사내망 주소를 요청하게 된다.
 * 순수 함수만 둔다. 외부 요청은 index.ts가 한다.
 */

export type LinkProvider = 'naver' | 'kakao';

/** 요청을 허용하는 호스트. 리디렉션을 따라갈 때도 이 밖으로 나가면 중단한다. */
export const LINK_HOSTS: Readonly<Record<LinkProvider, readonly string[]>> = {
  naver: ['naver.me', 'map.naver.com', 'm.map.naver.com', 'm.place.naver.com', 'pcmap.place.naver.com'],
  kakao: ['kko.to', 'place.map.kakao.com', 'map.kakao.com', 'm.map.kakao.com'],
};

/** 링크에서 읽어 낸 장소. 좌표는 제공자의 값 그대로다(모델이 만든 값이 아니다). */
export interface LinkedPlace {
  provider: LinkProvider;
  id: string;
  name: string;
  roadAddress: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
  /** 사용자가 다시 열어 볼 원본 주소 */
  url: string;
}

/** 허용한 지도 링크면 제공자를 돌려준다. 호스트가 목록과 정확히 같아야 하고 https만 받는다. */
export function linkProvider(url: string): LinkProvider | null {
  const parsed = parse(url);
  if (!parsed) return null;
  for (const provider of ['naver', 'kakao'] as const) {
    if (LINK_HOSTS[provider].includes(parsed.hostname)) return provider;
  }
  return null;
}

/**
 * 주소에서 장소 번호를 꺼낸다. 짧은 링크(naver.me·kko.to)에는 번호가 없어 null이다.
 * - 네이버: 장소 페이지의 `/{업종}/{번호}`, 지도 주소의 `/place/{번호}`, 또는 `pinId`·`id` 값
 * - 카카오: `place.map.kakao.com/{번호}`, 또는 `itemId` 값
 */
export function placeIdFrom(url: string): string | null {
  const parsed = parse(url);
  const provider = parsed && linkProvider(url);
  if (!parsed || !provider) return null;
  if (provider === 'naver') {
    if (parsed.hostname === 'naver.me') return null;
    // 장소 페이지는 업종마다 경로가 다르다(/place/·/restaurant/·/accommodation/ 등). 업종 칸 다음의 번호를 쓴다.
    const inPath = parsed.hostname.endsWith('place.naver.com')
      ? /^\/[a-z]+\/(\d{5,})(?:\/|$)/.exec(parsed.pathname)?.[1]
      : /\/place\/(\d{5,})(?:\/|$)/.exec(parsed.pathname)?.[1];
    return inPath ?? digits(parsed.searchParams.get('pinId')) ?? digits(parsed.searchParams.get('id'));
  }
  if (parsed.hostname === 'kko.to') return null;
  if (parsed.hostname === 'place.map.kakao.com') return /^\/(?:m\/)?(\d{3,})(?:\/|$)/.exec(parsed.pathname)?.[1] ?? null;
  return digits(parsed.searchParams.get('itemId'));
}

/** 장소 번호로 읽을 주소. 네이버는 모바일 장소 페이지, 카카오는 장소 정보(JSON)다. */
export function sourceUrl(provider: LinkProvider, id: string): string {
  return provider === 'naver'
    ? `https://m.place.naver.com/place/${id}/home`
    : `https://place-api.map.kakao.com/places/panel3/${id}`;
}

/** 사용자에게 남길 원본 주소. */
export function originalUrl(provider: LinkProvider, id: string): string {
  return provider === 'naver' ? `https://m.place.naver.com/place/${id}/home` : `https://place.map.kakao.com/${id}`;
}

/**
 * 네이버 모바일 장소 페이지에서 장소를 읽는다. 본문의 `"PlaceDetailBase:{번호}"` 데이터에 이름·주소·분류·좌표가 있다.
 * 구조가 바뀌어 읽지 못하면 null이다.
 */
export function readNaverPlace(html: string, id: string): LinkedPlace | null {
  const start = html.indexOf(`"PlaceDetailBase:${id}":{`);
  if (start < 0) return null;
  // 장소 하나의 데이터만 본다. 다른 장소(주변 추천 등)의 값과 섞이지 않게 다음 묶음 전까지로 자른다.
  const chunk = html.slice(start, start + 40_000);
  const text = (key: string) => {
    const raw = new RegExp(`"${key}":"((?:[^"\\\\]|\\\\.)*)"`).exec(chunk)?.[1];
    return raw === undefined ? '' : (JSON.parse(`"${raw}"`) as string).trim();
  };
  const coordinate = /"coordinate":\{[^}]*?"x":"(-?[\d.]+)","y":"(-?[\d.]+)"/.exec(chunk);
  const name = text('name');
  const lng = Number(coordinate?.[1]);
  const lat = Number(coordinate?.[2]);
  if (!name || !validPoint(lat, lng)) return null;
  return {
    provider: 'naver',
    id,
    name,
    roadAddress: text('roadAddress'),
    address: text('address'),
    lat,
    lng,
    category: text('category'),
    url: originalUrl('naver', id),
  };
}

/** 카카오 장소 정보(JSON)의 summary에서 장소를 읽는다. 구조가 바뀌어 읽지 못하면 null이다. */
export function readKakaoPlace(json: unknown, id: string): LinkedPlace | null {
  const summary = (json as { summary?: KakaoSummary } | null)?.summary;
  const name = typeof summary?.name === 'string' ? summary.name.trim() : '';
  const lat = Number(summary?.point?.lat);
  const lng = Number(summary?.point?.lon);
  if (!name || !validPoint(lat, lng)) return null;
  const road = summary?.address?.road ?? '';
  const jibun = summary?.address?.jibun ?? '';
  // 지번은 동 이하만 온다(매산로2가 28-2). 시·구는 도로명의 앞부분에서 가져와 붙인다.
  const area = road.split(' ').slice(0, -2).join(' ');
  return {
    provider: 'kakao',
    id: String(summary?.confirm_id ?? id),
    name,
    roadAddress: road,
    address: jibun && area ? `${area} ${jibun}` : (summary?.address?.disp ?? jibun),
    lat,
    lng,
    category: summary?.category?.name2 ?? summary?.category?.name ?? '',
    url: originalUrl('kakao', id),
  };
}

interface KakaoSummary {
  confirm_id?: string;
  name?: string;
  point?: { lat?: number; lon?: number };
  address?: { road?: string; jibun?: string; disp?: string };
  category?: { name?: string; name2?: string };
}

/** 국내 장소만 다룬다. 좌표가 비었거나 엉뚱하면 읽지 못한 것으로 본다. */
function validPoint(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat > 32 && lat < 39.5 && lng > 124 && lng < 132;
}

function digits(value: string | null): string | null {
  return value && /^\d{3,}$/.test(value) ? value : null;
}

function parse(url: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  // https만 받는다. http는 중간에서 내용을 바꿀 수 있다.
  if (parsed.protocol !== 'https:') return null;
  // 끝자리 비교(endsWith)를 쓰면 naver.me.evil.test가 통과한다. 목록과 정확히 같아야 한다.
  const allowed = [...LINK_HOSTS.naver, ...LINK_HOSTS.kakao];
  return allowed.includes(parsed.hostname) ? parsed : null;
}
