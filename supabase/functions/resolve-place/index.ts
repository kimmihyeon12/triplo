import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { createResolvePlaceHandler, type Hop } from './handler.ts';

// 이 비밀값은 Supabase Edge 런타임이 넣는다. 브라우저는 볼 수 없다.
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** 네이버는 데스크톱으로 요청하면 빈 껍데기만 준다. 모바일 브라우저로 요청한다(2026-09-20·10-01 확인). */
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/** 읽을 최대 크기. 네이버 장소 데이터는 앞에서 약 36만 바이트 뒤에 있다(2026-10-01). */
const MAX_BYTES = 1024 * 1024;
const TIMEOUT_MS = 8000;

Deno.serve(
  createResolvePlaceHandler({
    async getUser(token) {
      const { data, error } = await admin.auth.getUser(token);
      return error ? null : data.user;
    },
    async fetchOnce(url, provider): Promise<Hop> {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          // 리디렉션은 handler가 한 번씩 따라가며 호스트를 확인한다.
          redirect: 'manual',
          signal: abort.signal,
          headers:
            provider === 'naver'
              ? { 'user-agent': MOBILE_UA, 'accept-language': 'ko' }
              : { 'user-agent': MOBILE_UA, referer: 'https://place.map.kakao.com/', pf: 'web', accept: 'application/json' },
        });
        const location = response.headers.get('location');
        if (response.status >= 300 && response.status < 400) {
          await response.body?.cancel();
          return { status: response.status, location, body: '' };
        }
        return { status: response.status, location, body: await readLimited(response) };
      } finally {
        clearTimeout(timer);
      }
    },
  }),
);

/** 본문을 MAX_BYTES까지만 읽는다. 네이버 장소 좌표를 지나면 더 읽지 않는다. */
async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let body = '';
  let read = 0;
  while (read < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    read += value.byteLength;
    body += decoder.decode(value, { stream: true });
    const base = body.indexOf('"PlaceDetailBase:');
    if (base >= 0 && body.indexOf('"mapZoomLevel"', base) >= 0) break;
  }
  await reader.cancel().catch(() => undefined);
  return body;
}
