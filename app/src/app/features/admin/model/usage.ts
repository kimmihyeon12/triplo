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
