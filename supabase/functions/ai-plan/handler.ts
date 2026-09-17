import { buildUserPrompt, SYSTEM_PROMPT, type AiPlanInput } from './prompt.ts';

/**
 * AI 일정 만들기. 브라우저가 모델을 직접 부르지 않고 이 함수를 거친다.
 * 모델 키는 서버 환경변수에만 있고 브라우저에는 들어가지 않는다.
 *
 * 브라우저가 보내는 것은 사용자가 고른 조건뿐이다. 지시문과 모델 이름은
 * 서버가 갖는다. 요청을 바꿔 모델에게 다른 일을 시키지 못하게 하기 위해서다.
 */

export interface AiPlanDeps {
  /** 토큰을 검증해 사용자를 돌려준다. 실패하면 null. */
  getUser(token: string): Promise<{ id: string } | null>;
  /** 모델을 부르고 응답 본문(JSON 문자열)을 돌려준다. */
  callModel(prompt: { system: string; user: string }): Promise<string>;
}

/** 한 번에 만들 수 있는 여행 길이. 지나치게 길면 토큰만 쓰고 쓸모도 없다. */
const MAX_DAYS = 30;

export function createAiPlanHandler(deps: AiPlanDeps) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
  const reply = (status: number, body: object) =>
    new Response(JSON.stringify(body), { status, headers });

  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });

    // 로그인한 사람만 쓴다. 키를 숨기는 것만으로는 아무나 쓰는 것을 막지 못한다.
    const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
    if (!token) return reply(401, { error: 'authentication_required' });

    try {
      const user = await deps.getUser(token);
      if (!user) return reply(401, { error: 'authentication_required' });

      const body = (await request.json().catch(() => null)) as Partial<AiPlanInput> | null;
      const input = validate(body);
      if (!input) return reply(400, { error: 'invalid_request' });

      const content = await deps.callModel({
        system: SYSTEM_PROMPT,
        user: buildUserPrompt(input),
      });
      return reply(200, { content });
    } catch (error) {
      // 하루 한도 초과는 사용자가 할 수 있는 일이 다르므로 따로 알린다.
      if (error instanceof Error && error.message === 'quota_exceeded')
        return reply(429, { error: 'quota_exceeded' });
      return reply(500, { error: 'generation_failed' });
    }
  };
}

/** 받은 조건이 쓸 수 있는 모양인지 본다. 모르는 값은 채우지 않고 거절한다. */
function validate(body: Partial<AiPlanInput> | null): AiPlanInput | null {
  if (!body) return null;
  const regions = Array.isArray(body.regions)
    ? body.regions.filter((r): r is string => typeof r === 'string' && r.trim() !== '')
    : [];
  if (!regions.length) return null;
  const dayCount = body.dayCount;
  if (typeof dayCount !== 'number' || !Number.isInteger(dayCount)) return null;
  if (dayCount < 1 || dayCount > MAX_DAYS) return null;

  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  return {
    regions,
    dayCount,
    companion: text(body.companion),
    transport: text(body.transport),
    pace: text(body.pace),
    taste: text(body.taste),
    mustGo: text(body.mustGo),
    bookedStay: text(body.bookedStay),
    extraNote: text(body.extraNote),
  };
}
