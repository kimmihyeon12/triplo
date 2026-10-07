/**
 * 관리자 사용량 화면의 계산(2026-10-07). 설계: docs/superpowers/specs/2026-10-07-admin-usage-design.md
 * 서버는 숫자만 모으고, 무료 한도·단가와 견주는 일은 여기서 한다. 단가가 바뀌면 이 파일만 고친다.
 */

/**
 * 무료 한도. Gemini 하루 500회는 2026-09-17 AI-PLANNING.md에 기록한 값이며 구글이 모델·시기마다
 * 바꾼다. 화면에 AI Studio 한도 링크를 함께 둔다. Supabase는 2026-10-07 요금 안내에서 확인했다.
 */
export const FREE_LIMITS = {
  geminiDailyRequests: 500,
  dbBytes: 500 * 1024 ** 2,
  storageBytes: 1024 ** 3,
  activeUsers: 50_000,
} as const;

/** 100만 토큰당 달러. https://ai.google.dev/gemini-api/docs/pricing (표준 요금) */
export const PRICES: Readonly<Record<string, { inputUsdPerM: number; outputUsdPerM: number }>> = {
  'gemini-3.5-flash-lite': { inputUsdPerM: 0.3, outputUsdPerM: 2.5 },
};
export const PRICE_CHECKED_ON = '2026-10-07';
/** AI-PLANNING.md의 유료 전환 비용 표와 같은 환율 */
export const USD_KRW = 1355;

export type UsageLevel = 'ok' | 'warn' | 'over';

/** 80% 이상이면 경고, 한도에 닿으면 넘친 것으로 본다. */
export function usageLevel(used: number, limit: number): UsageLevel {
  if (used >= limit) return 'over';
  return used >= limit * 0.8 ? 'warn' : 'ok';
}

export type AiCallKind = 'plan' | 'chat' | 'receipt';

export interface MonthRow {
  readonly kind: AiCallKind;
  readonly model: string;
  readonly requests: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface UsageSummary {
  readonly measuredAt: string;
  readonly gemini: {
    readonly dayStart: string;
    readonly dayRequests: number;
    readonly dayFailed: number;
    /** 하루 기준이 바뀐 직후에도 실제 사용량이 보이도록 함께 센다(2026-10-07). */
    readonly last24hRequests: number;
    /** 이번 달 첫 기록 시각. 기록이 없으면 null. 예상 월 비용을 이 날부터 센다. */
    readonly monthSince: string | null;
    readonly month: readonly MonthRow[];
  };
  readonly supabase: {
    readonly dbBytes: number;
    readonly storageBytes: number;
    readonly activeUsers30d: number;
  };
}

/** 단가표에 없는 모델이면 null. 모르는 값을 0원으로 보이면 비용을 낮춰 보게 된다. */
export function rowCostKrw(row: MonthRow): number | null {
  const price = PRICES[row.model];
  if (!price) return null;
  const usd = (row.inputTokens * price.inputUsdPerM + row.outputTokens * price.outputUsdPerM) / 1_000_000;
  return usd * USD_KRW;
}

export function monthCost(rows: readonly MonthRow[]): { totalKrw: number; unpricedRequests: number } {
  let totalKrw = 0;
  let unpricedRequests = 0;
  for (const row of rows) {
    const cost = rowCostKrw(row);
    if (cost === null) unpricedRequests += row.requests;
    else totalKrw += cost;
  }
  return { totalKrw, unpricedRequests };
}

const KINDS: readonly string[] = ['plan', 'chat', 'receipt'];

function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new Error('bad_usage_summary');
  return value;
}

function text(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('bad_usage_summary');
  return value;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('bad_usage_summary');
  return value as Record<string, unknown>;
}

/** 서버 응답을 검사한다. 형식이 깨졌으면 숫자를 지어내지 않고 오류로 알린다. */
export function toUsageSummary(raw: unknown): UsageSummary {
  const root = record(raw);
  const gemini = record(root['gemini']);
  const supabase = record(root['supabase']);
  const month = gemini['month'];
  if (!Array.isArray(month)) throw new Error('bad_usage_summary');
  return {
    measuredAt: text(root['measuredAt']),
    gemini: {
      dayStart: text(gemini['dayStart']),
      dayRequests: count(gemini['dayRequests']),
      dayFailed: count(gemini['dayFailed']),
      last24hRequests: count(gemini['last24hRequests']),
      monthSince: gemini['monthSince'] === null ? null : text(gemini['monthSince']),
      month: month.map((item) => {
        const row = record(item);
        const kind = text(row['kind']);
        if (!KINDS.includes(kind)) throw new Error('bad_usage_summary');
        return {
          kind: kind as AiCallKind,
          model: text(row['model']),
          requests: count(row['requests']),
          inputTokens: count(row['inputTokens']),
          outputTokens: count(row['outputTokens']),
        };
      }),
    },
    supabase: {
      dbBytes: count(supabase['dbBytes']),
      storageBytes: count(supabase['storageBytes']),
      activeUsers30d: count(supabase['activeUsers30d']),
    },
  };
}

/** Supabase Pro 플랜 월 $25(https://supabase.com/pricing, 2026-10-07 확인). 사용자 수와 관계없는 정액이다. */
export const SUPABASE_PRO_KRW = 25 * USD_KRW;
const SCENARIO_USERS = [10, 100, 1000, 10000] as const;

/**
 * 이번 달 기록을 한 달로 늘려 최근 30일 활성 사용자 1명당 Gemini 비용을 구한다(2026-10-07 사용자 요청).
 * 사용자나 기록이 없으면 null이다. 모르는 값을 0원으로 보이면 비용을 낮춰 보게 된다.
 */
export function projectPerUser(
  summary: UsageSummary,
): { perUserKrw: number; basisDays: number; users: number } | null {
  const users = summary.supabase.activeUsers30d;
  if (!users || !summary.gemini.month.length) return null;
  // 기록이 이번 달 중간부터 쌓였으면 그날부터 센다. 1일부터 세면 비용을 낮춰 본다(2026-10-07).
  const kstDay = (iso: string) => new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  const kst = kstDay(summary.measuredAt);
  const since = summary.gemini.monthSince ? kstDay(summary.gemini.monthSince).getUTCDate() : 1;
  const basisDays = Math.max(1, kst.getUTCDate() - since + 1);
  const daysInMonth = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() + 1, 0)).getUTCDate();
  const monthKrw = monthCost(summary.gemini.month).totalKrw;
  return { perUserKrw: (monthKrw / users) * (daysInMonth / basisDays), basisDays, users };
}

export interface UserScenario {
  readonly users: number;
  readonly geminiKrw: number;
  readonly withProKrw: number;
  readonly perUserWithProKrw: number;
}

/** 사용자 수마다 Gemini 비용, Supabase Pro를 더한 비용, 그때 1명당 비용 */
export function userScenarios(perUserKrw: number): UserScenario[] {
  return SCENARIO_USERS.map((users) => {
    const geminiKrw = perUserKrw * users;
    const withProKrw = geminiKrw + SUPABASE_PRO_KRW;
    return { users, geminiKrw, withProKrw, perUserWithProKrw: withProKrw / users };
  });
}
