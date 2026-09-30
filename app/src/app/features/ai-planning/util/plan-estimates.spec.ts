import { describe, expect, it } from 'vitest';
import { parseAiItems } from './ai-response';
import {
  costRange,
  parsePlanEstimate,
  summarizeEstimates,
  summarizeGroups,
  priceLabel,
  costBasis,
  estimateMemo,
} from '../../../shared/util/plan-estimate';

describe('AI 예상 비용과 체류시간', () => {
  it('저장 가능한 정수 금액을 초과하면 미정으로 처리한다', () => {
    expect(
      costRange(
        {
          cost: {
            min: 10000000,
            max: 10000000,
            basis: 'person',
            quantity: 100,
            assumption: '입장',
          },
          stay: null,
        },
        100,
      ),
    ).toBeNull();
  });
  it('일행/객실 단위에는 인원을 다시 곱하지 않는다', () => {
    expect(
      costRange(
        {
          cost: {
            min: 100000,
            max: 150000,
            basis: 'room_night',
            quantity: 2,
            assumption: '1객실 2박',
          },
          stay: null,
        },
        4,
      ),
    ).toEqual({ min: 200000, max: 300000 });
    expect(
      costRange(
        {
          cost: {
            min: 25000,
            max: 30000,
            basis: 'group',
            quantity: 1,
            assumption: '피자 1판 공유',
          },
          stay: null,
        },
        3,
      ),
    ).toEqual({ min: 25000, max: 30000 });
  });

  it('0원 예상과 미정을 구별하고 모델의 확인 주장·출처를 버린다', () => {
    const estimate = parsePlanEstimate({
      cost: {
        min: 0,
        max: 0,
        basis: 'person',
        quantity: 1,
        assumption: '입장료',
        verified: true,
        source: 'https://fake.test',
      },
      stay: null,
    });
    expect(estimate.cost).not.toHaveProperty('verified');
    expect(estimate.cost).not.toHaveProperty('source');
    expect(summarizeEstimates([{ day: 1, estimate }, { day: 1 }], 2)).toMatchObject({
      min: 0,
      max: 0,
      known: 1,
      unknown: 1,
    });
  });

  it.each([
    { min: 200, max: 100, basis: 'person', quantity: 1, assumption: '입장' },
    { min: 100, max: 200, basis: 'fake', quantity: 1, assumption: '입장' },
    { min: 100, max: 200, basis: 'person', quantity: 0, assumption: '입장' },
    { min: 100, max: 200, basis: 'person', quantity: 1, assumption: '' },
  ])('사용할 수 없는 단가 정보를 미정 처리한다', (cost) => {
    expect(parsePlanEstimate({ cost, stay: { min: 90, max: 60, reason: '관람' } })).toEqual({
      cost: null,
      stay: null,
    });
  });
  it('요금 기준과 체류 범위를 보존한다', () => {
    const items = parseAiItems(
      JSON.stringify({
        items: [
          {
            day: 1,
            name: '식당',
            kind: '식사',
            estimate: {
              cost: {
                min: 15000,
                max: 20000,
                basis: 'person',
                quantity: 1,
                assumption: '식사 1회',
              },
              stay: { min: 45, max: 60, reason: '여유 있는 식사' },
            },
          },
        ],
      }),
      1,
    );
    expect(items[0]).toMatchObject({
      estimate: { cost: { min: 15000, max: 20000, basis: 'person' }, stay: { min: 45, max: 60 } },
    });
  });

  it.each([null, -1, '10000', Infinity])('잘못된 금액 %s는 미정으로 둔다', (min) => {
    const items = parseAiItems(
      JSON.stringify({
        items: [
          {
            day: 1,
            name: '식당',
            kind: '식사',
            estimate: {
              cost: { min, max: 20000, basis: 'person', quantity: 1, assumption: '식사' },
              stay: null,
            },
          },
        ],
      }),
      1,
    );
    expect(items[0]).toMatchObject({ estimate: { cost: null, stay: null } });
  });
});

describe('summarizeGroups', () => {
  it('분류 묶음별로 합계와 미정 개수를 센다', () => {
    const cost = (min: number, max: number) => ({ cost: { min, max, basis: 'group' as const, quantity: 1, assumption: 'x' }, stay: null });
    const out = summarizeGroups([
      { group: 'food', estimate: cost(10000, 12000) }, { group: 'food' },
      { group: 'stay', estimate: cost(90000, 120000) },
    ], 2, ['food', 'stay', 'activity', 'shopping', 'other'] as const);
    expect(out.food).toEqual({ min: 10000, max: 12000, known: 1, unknown: 1 });
    expect(out.stay.max).toBe(120000);
    expect(out.activity).toEqual({ min: 0, max: 0, known: 0, unknown: 0 });
    expect(out.other).toEqual({ min: 0, max: 0, known: 0, unknown: 0 });
  });
});

describe('무료 표시', () => {
  const free = { cost: { min: 0, max: 0, basis: 'group' as const, quantity: 1, assumption: '입장 무료' }, stay: null };
  it('0원 요금은 무료로 쓴다', () => {
    expect(priceLabel(costRange(free, 2))).toBe('무료');
    expect(priceLabel(null)).toBe('미정');
    expect(priceLabel({ min: 1000, max: 2000 })).toBe('1,000~2,000원');
  });
  it('요금 기준과 메모도 무료로 쓴다', () => {
    expect(costBasis(free, 2)).toBe('무료 · 입장 무료');
    expect(estimateMemo(free, 2)).toContain('예상 비용 무료');
  });
});
