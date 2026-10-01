import {
  buildUserPrompt,
  CANDIDATE_KIND_LABEL,
  GROUNDED_SYSTEM_PROMPT,
  SYSTEM_PROMPT,
  type AiPlanInput,
  type CandidateKind,
  type PlanCandidate,
} from './prompt.ts';
import { UserLimitError } from '../_shared/quota.ts';

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
  /** 오늘 한 번을 차감하고 남은 횟수를 돌려준다. 한도를 넘으면 UserLimitError. */
  consumeQuota(userId: string): Promise<number>;
  /** 모델 호출이 실패했을 때 차감한 한 번을 돌려준다. */
  refundQuota(userId: string): Promise<void>;
}

/** 한 번에 만들 수 있는 여행 길이. 지나치게 길면 토큰만 쓰고 쓸모도 없다. */
const MAX_DAYS = 30;
/** 후보 상한. 지역 3곳 × 종류별 검색. 넘으면 요청을 거절한다. */
const MAX_CANDIDATES = 120;

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

      // 검증을 통과한 요청만 센다. 모델이 실패하면 되돌려 실패한 요청은 세지 않는다.
      const remaining = await deps.consumeQuota(user.id);
      let content: string;
      try {
        // 후보가 있으면 후보 안에서 ref로만 고르게 하는 지시문을 쓴다.
        const system = input.candidates?.length ? GROUNDED_SYSTEM_PROMPT : SYSTEM_PROMPT;
        content = await deps.callModel({ system, user: buildUserPrompt(input) });
        // 안전 차단 등으로 빈 답이 오면 쓸 수 없는 결과다. 실패로 보고 되돌린다.
        if (!content.trim()) throw new Error('empty_response');
      } catch (error) {
        await deps.refundQuota(user.id).catch(() => {});
        throw error;
      }
      return reply(200, { content, remaining });
    } catch (error) {
      if (error instanceof UserLimitError)
        return reply(429, { error: 'user_limit', limit: error.limit });
      if (error instanceof Error && error.message === 'quota_check_failed')
        return reply(503, { error: 'server_unavailable' });
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

  const partySize = body.partySize === undefined ? 1 : body.partySize;
  const budget = body.budget === undefined ? null : body.budget;
  const budgetBasis = body.budgetBasis === undefined ? 'group' : body.budgetBasis;
  if (typeof partySize !== 'number' || !Number.isInteger(partySize) || partySize < 1 || partySize > 100) return null;
  if (budget !== null && (typeof budget !== 'number' || !Number.isSafeInteger(budget) || budget < 0 || budget > 100_000_000)) return null;
  if (budgetBasis !== 'person' && budgetBasis !== 'group') return null;
  // 시작일은 요일별 휴무를 알려 주려고 받는다. 없으면 날짜 미정 여행이다.
  const startDate = body.startDate === undefined || body.startDate === null ? null : body.startDate;
  if (startDate !== null && !isIsoDate(startDate)) return null;
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  const candidates = validCandidates(body.candidates);
  if (candidates === null) return null;
  return {
    candidates,
    regions,
    dayCount,
    partySize, budget, budgetBasis, startDate,
    companion: text(body.companion),
    transport: text(body.transport),
    pace: text(body.pace),
    taste: text(body.taste),
    mustGo: text(body.mustGo),
    bookedStay: text(body.bookedStay),
    extraNote: text(body.extraNote),
  };
}

/** 후보 목록을 검사한다. 없으면 빈 목록, 모양이 틀리면 null(요청 거절). */
function validCandidates(value: unknown): PlanCandidate[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_CANDIDATES) return null;
  const bounded = (v: unknown, max: number, required = true): v is string =>
    typeof v === 'string' && v.length <= max && (!required || v.trim() !== '');
  const out: PlanCandidate[] = [];
  for (const c of value) {
    if (!c || typeof c !== 'object') return null;
    const { id, name, kind, category, area } = c as Record<string, unknown>;
    if (typeof id !== 'string' || !/^c\d{1,3}$/.test(id)) return null;
    if (!bounded(name, 120) || !bounded(category, 120, false) || !bounded(area, 60, false)) return null;
    if (typeof kind !== 'string' || !(kind in CANDIDATE_KIND_LABEL)) return null;
    out.push({ id, name: name.trim(), kind: kind as CandidateKind, category, area });
  }
  return out;
}

/** 'YYYY-MM-DD'이고 실제로 있는 날짜인지 본다. 2026-13-01 같은 값은 거절한다. */
function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
