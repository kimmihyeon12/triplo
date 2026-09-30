import type { ExpenseCategory, ExpensePerson } from '../model/ledger';
import type { PlanKind, StopKind } from '../../trips/model/trip';

/** 지출 폼에서 고를 수 있는 일정 항목. */
export interface ExpenseLink {
  id: string;
  name: string;
  estimatedCost?: number | null;
  /** 일정 항목의 종류에서 옮긴 지출 분류. */
  category: ExpenseCategory;
}

interface StopLike {
  id: string;
  name: string;
  kind: StopKind;
  excluded: boolean;
  estimatedCost?: number | null;
}

interface StayLike {
  id: string;
  name: string;
  estimatedCost?: number | null;
}

/**
 * 일정 분류 → 가계부 분류의 유일한 대응표. AI 예산 묶음도 이 표를 쓴다(2026-09-30 정산 라벨 통일).
 * 식사·카페는 식비, 관광·액티비티는 관광·액티비티, 숙소는 숙박이다. 여유시간처럼 종류로
 * 지출을 알 수 없으면 기타로 둔다.
 */
export const KIND_EXPENSE_CATEGORY: Record<PlanKind, ExpenseCategory> = {
  place: 'activity',
  activity: 'activity',
  meal: 'food',
  break: 'food',
  shopping: 'shopping',
  other: 'other',
  buffer: 'other',
  stay: 'stay',
};

export function expenseCategoryOf(kind: PlanKind): ExpenseCategory {
  return KIND_EXPENSE_CATEGORY[kind];
}

/** 지출에 연결할 수 있는 일정 항목. 일정에서 뺀 장소는 넣지 않는다. */
export function expenseLinks(stops: readonly StopLike[], stays: readonly StayLike[]): ExpenseLink[] {
  return [
    ...stops
      .filter((s) => !s.excluded)
      .map((s) => ({ id: s.id, name: s.name, estimatedCost: s.estimatedCost, category: expenseCategoryOf(s.kind) })),
    ...stays.map((s) => ({ id: s.id, name: s.name, estimatedCost: s.estimatedCost, category: expenseCategoryOf('stay') })),
  ];
}

/**
 * 새 지출의 결제자 기본값. 대부분 기록하는 사람이 냈으므로 나(me)를 먼저 고른다.
 * 함께 쓰는 여행에 합류한 친구의 '나'는 'self'(주인)가 아니라 자기 칸이다.
 */
export function defaultPayer(people: readonly ExpensePerson[], me = 'self'): string {
  return (
    people.find((p) => p.id === me)?.id ??
    people.find((p) => p.id === 'self')?.id ??
    people[0]?.id ??
    ''
  );
}
