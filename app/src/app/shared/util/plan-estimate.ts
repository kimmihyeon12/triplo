import type { PlanEstimate } from '../model/plan-estimate';
export type { PlanEstimate } from '../model/plan-estimate';

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}
function text(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 160) : '';
}

/** 모델이 붙인 verified/source URL 등은 받지 않는다. 실제 검증 경로가 생기기 전에는 전부 추정이다. */
export function parsePlanEstimate(value: unknown): PlanEstimate {
  const raw = record(value),
    cost = record(raw['cost']),
    stay = record(raw['stay']);
  const basis = cost['basis'];
  return {
    cost:
      integer(cost['min'], 0, 10_000_000) &&
      integer(cost['max'], 0, 10_000_000) &&
      cost['min'] <= cost['max'] &&
      (basis === 'person' || basis === 'group' || basis === 'room_night') &&
      integer(cost['quantity'], 1, 100) &&
      text(cost['assumption'])
        ? {
            min: cost['min'],
            max: cost['max'],
            basis,
            quantity: cost['quantity'],
            assumption: text(cost['assumption']),
          }
        : null,
    stay:
      integer(stay['min'], 5, 1440) &&
      integer(stay['max'], 5, 1440) &&
      stay['min'] <= stay['max'] &&
      text(stay['reason'])
        ? { min: stay['min'], max: stay['max'], reason: text(stay['reason']) }
        : null,
  };
}

export function costRange(
  estimate: PlanEstimate | undefined,
  partySize: number,
): { min: number; max: number } | null {
  const cost = estimate?.cost;
  if (!cost) return null;
  const multiplier = cost.quantity * (cost.basis === 'person' ? partySize : 1);
  const min = cost.min * multiplier,
    max = cost.max * multiplier;
  // trip_stops.estimated_cost는 PostgreSQL integer다. 한 항목 때문에 전체 저장이 실패하지 않게 한다.
  return Number.isSafeInteger(min) && Number.isSafeInteger(max) && min >= 0 && max <= 2_147_483_647
    ? { min, max }
    : null;
}

export function wonRange(range: { min: number; max: number } | null): string {
  if (!range) return '미정';
  const fmt = (n: number) => n.toLocaleString('ko-KR');
  return range.min === range.max ? `${fmt(range.min)}원` : `${fmt(range.min)}~${fmt(range.max)}원`;
}

export function costBasis(estimate: PlanEstimate | undefined, partySize: number): string {
  const cost = estimate?.cost;
  if (!cost || !costRange(estimate, partySize)) return '요금 정보 미정';
  const unit =
    cost.basis === 'person'
      ? `1인당 ${wonRange(cost)} × ${partySize}명 × ${cost.quantity}회`
      : cost.basis === 'room_night'
        ? `객실당 1박 ${wonRange(cost)} × ${cost.quantity}객실·박`
        : `일행 전체 1회 ${wonRange(cost)} × ${cost.quantity}회`;
  return `${unit} · ${cost.assumption}`;
}

export function estimateMemo(estimate: PlanEstimate | undefined, partySize: number): string {
  if (!estimate?.cost && !estimate?.stay) return '';
  const lines = ['AI 추정 계획 · 공식 요금 및 실제 지출과 다름'];
  if (estimate.cost)
    lines.push(
      `예상 비용 ${wonRange(costRange(estimate, partySize))} (${costBasis(estimate, partySize)})`,
    );
  if (estimate.stay)
    lines.push(`추천 체류 ${estimate.stay.min}~${estimate.stay.max}분 · ${estimate.stay.reason}`);
  lines.push('계획 금액·체류시간은 추천 범위의 상한으로 설정했습니다. 방문 전 확인하세요.');
  return lines.join('\n');
}

export function summarizeEstimates(
  items: readonly { day: number; estimate?: PlanEstimate }[],
  partySize: number,
) {
  const total = { min: 0, max: 0, known: 0, unknown: 0 };
  const days = new Map<number, typeof total>();
  for (const item of items) {
    const day = days.get(item.day) ?? { min: 0, max: 0, known: 0, unknown: 0 };
    const range = costRange(item.estimate, partySize);
    for (const target of [total, day]) {
      if (range) {
        target.min += range.min;
        target.max += range.max;
        target.known++;
      } else target.unknown++;
    }
    days.set(item.day, day);
  }
  return {
    ...total,
    days: [...days].sort(([a], [b]) => a - b).map(([day, costs]) => ({ day, ...costs })),
  };
}

type RangeTotal = { min: number; max: number; known: number; unknown: number };

/**
 * 묶음별 예상 합계. 묶음 이름은 호출하는 쪽이 정한다(AI 일정은 가계부 분류를 쓴다).
 * 요금이 미정이면 미정 개수로만 센다. 0원으로 채우지 않는다.
 */
export function summarizeGroups<K extends string>(
  items: readonly { group: K; estimate?: PlanEstimate }[],
  partySize: number,
  groups: readonly K[],
): Record<K, RangeTotal> {
  const out = Object.fromEntries(groups.map((g) => [g, { min: 0, max: 0, known: 0, unknown: 0 }])) as Record<K, RangeTotal>;
  for (const item of items) {
    const target = out[item.group];
    if (!target) continue;
    const range = costRange(item.estimate, partySize);
    if (range) {
      target.min += range.min;
      target.max += range.max;
      target.known++;
    } else target.unknown++;
  }
  return out;
}
