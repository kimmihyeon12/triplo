import { describe, expect, it } from 'vitest';
import { FREE_LIMITS, SUPABASE_PRO_KRW, monthCost, projectPerUser, rowCostKrw, toUsageSummary, usageLevel, userScenarios } from './usage';

const RAW = {
  measuredAt: '2026-10-07T06:00:00+00:00',
  gemini: {
    dayStart: '2026-10-07T07:00:00+00:00',
    dayRequests: 42,
    dayFailed: 1,
    last24hRequests: 50,
    monthSince: '2026-09-30T15:00:00+00:00',
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
    expect(s.gemini.last24hRequests).toBe(50);
    expect(s.gemini.month).toHaveLength(2);
    expect(s.supabase.activeUsers30d).toBe(12);
  });
  it.each([
    null,
    {},
    { ...RAW, gemini: { ...RAW.gemini, dayRequests: '42' } },
    { ...RAW, gemini: { ...RAW.gemini, last24hRequests: undefined } },
    { ...RAW, gemini: { ...RAW.gemini, monthSince: 5 } },
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

describe('사용자 수별 예상 월 비용', () => {
  it('이번 달 기록을 한 달로 늘려 활성 사용자 1명당 비용을 구한다', () => {
    // 10월 7일(한국 시간)까지 7일 동안 1,178.85원, 활성 사용자 12명 → 1,178.85 / 12 × 31 / 7
    const p = projectPerUser(toUsageSummary(RAW))!;
    expect(p.basisDays).toBe(7);
    expect(p.users).toBe(12);
    expect(p.perUserKrw).toBeCloseTo(435.05, 1);
  });
  it('기록이 이번 달 중간부터 쌓였으면 그날부터 센다', () => {
    // 2026-10-07 오후에 기록을 시작했다. 1일부터 7일로 나누면 하루치를 7일치로 나눠 7분의 1로 낮아졌다.
    const late = toUsageSummary({ ...RAW, gemini: { ...RAW.gemini, monthSince: '2026-10-07T06:52:00+00:00' } });
    const p = projectPerUser(late)!;
    expect(p.basisDays).toBe(1);
    expect(p.perUserKrw).toBeCloseTo((1178.85 / 12) * 31, 1);
  });
  it('활성 사용자나 기록이 없으면 지어내지 않는다', () => {
    const none = toUsageSummary({ ...RAW, supabase: { ...RAW.supabase, activeUsers30d: 0 } });
    expect(projectPerUser(none)).toBeNull();
    const empty = toUsageSummary({ ...RAW, gemini: { ...RAW.gemini, month: [] } });
    expect(projectPerUser(empty)).toBeNull();
  });
  it('사용자 수마다 Gemini 월 비용을 보이고, 무료 한도 안의 Supabase 정액을 더하지 않는다', () => {
    // 표가 Supabase Pro($25)를 항상 더해 10명에도 1명당 3,823원처럼 보였다(2026-10-07 사용자 지적).
    const row = userScenarios(435.05).find((s) => s.users === 100)!;
    expect(Object.keys(row).sort()).toEqual(['geminiKrw', 'perUserKrw', 'users']);
    expect(row.geminiKrw).toBeCloseTo(43505, 0);
    expect(row.perUserKrw).toBeCloseTo(435.05, 2);
    expect(userScenarios(1).map((s) => s.users)).toEqual([10, 100, 1000, 10000]);
    expect(SUPABASE_PRO_KRW).toBe(25 * 1355);
  });
});
