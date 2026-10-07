import { describe, expect, it } from 'vitest';
import { FREE_LIMITS, monthCost, rowCostKrw, toUsageSummary, usageLevel } from './usage';

const RAW = {
  measuredAt: '2026-10-07T06:00:00+00:00',
  gemini: {
    dayStart: '2026-10-07T07:00:00+00:00',
    dayRequests: 42,
    dayFailed: 1,
    month: [
      { kind: 'chat', model: 'gemini-3.5-flash-lite', requests: 1000, inputTokens: 400_000, outputTokens: 300_000 },
      { kind: 'plan', model: 'old-model', requests: 3, inputTokens: 10, outputTokens: 10 },
    ],
  },
  supabase: { dbBytes: 31_457_280, storageBytes: 0, activeUsers30d: 12 },
};

describe('usageLevel', () => {
  it.each([
    [0, 500, 'ok'],
    [399, 500, 'ok'],
    [400, 500, 'warn'],
    [499, 500, 'warn'],
    [500, 500, 'over'],
    [900, 500, 'over'],
  ])('%i / %i → %s', (used, limit, level) => expect(usageLevel(used, limit)).toBe(level));
});

describe('비용 추정', () => {
  it('단가표로 원화를 계산한다: 입력 40만·출력 30만 토큰이면 약 1,179원', () => {
    // (0.4 × 0.30 + 0.3 × 2.50) 달러 × 1,355원
    expect(rowCostKrw(RAW.gemini.month[0]!)).toBeCloseTo(1178.85, 2);
  });
  it('단가가 없는 모델은 null이고 합계에서 빼며 몇 번인지 센다', () => {
    expect(rowCostKrw(RAW.gemini.month[1]!)).toBeNull();
    const cost = monthCost(toUsageSummary(RAW).gemini.month);
    expect(cost.totalKrw).toBeCloseTo(1178.85, 2);
    expect(cost.unpricedRequests).toBe(3);
  });
});

describe('toUsageSummary', () => {
  it('서버 응답을 그대로 옮긴다', () => {
    const s = toUsageSummary(RAW);
    expect(s.gemini.dayRequests).toBe(42);
    expect(s.gemini.month).toHaveLength(2);
    expect(s.supabase.activeUsers30d).toBe(12);
  });
  it.each([
    null,
    {},
    { ...RAW, gemini: { ...RAW.gemini, dayRequests: '42' } },
    { ...RAW, gemini: { ...RAW.gemini, month: [{ kind: 'chat' }] } },
    { ...RAW, supabase: { dbBytes: -1, storageBytes: 0, activeUsers30d: 0 } },
  ])('형식이 깨졌으면 오류다 %#', (raw) => expect(() => toUsageSummary(raw)).toThrow());
});

it('무료 한도는 Gemini 하루 500회, DB 500MB, 파일 1GB, 활성 사용자 5만 명이다', () => {
  expect(FREE_LIMITS).toEqual({
    geminiDailyRequests: 500,
    dbBytes: 500 * 1024 ** 2,
    storageBytes: 1024 ** 3,
    activeUsers: 50_000,
  });
});
