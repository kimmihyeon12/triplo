import type { EXPENSE_CATEGORIES, ExpensePerson } from '../model/ledger';

type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

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
  kind: 'place' | 'meal' | 'break' | 'buffer';
  excluded: boolean;
  estimatedCost?: number | null;
}

interface StayLike {
  id: string;
  name: string;
  estimatedCost?: number | null;
}

/**
 * 일정 항목의 종류로 지출 분류를 정한다. 식사·카페는 식비, 장소는 관광·활동,
 * 숙소는 숙박이다. 여유시간처럼 종류로 알 수 없으면 기타로 둔다.
 */
const STOP_CATEGORY: Record<StopLike['kind'], ExpenseCategory> = {
  meal: 'food',
  break: 'food',
  place: 'activity',
  buffer: 'other',
};

/** 지출에 연결할 수 있는 일정 항목. 일정에서 뺀 장소는 넣지 않는다. */
export function expenseLinks(stops: readonly StopLike[], stays: readonly StayLike[]): ExpenseLink[] {
  return [
    ...stops
      .filter((s) => !s.excluded)
      .map((s) => ({ id: s.id, name: s.name, estimatedCost: s.estimatedCost, category: STOP_CATEGORY[s.kind] })),
    ...stays.map((s) => ({ id: s.id, name: s.name, estimatedCost: s.estimatedCost, category: 'stay' as const })),
  ];
}

/** 새 지출의 결제자 기본값. 대부분 기록하는 사람이 냈으므로 '나'를 먼저 고른다. */
export function defaultPayer(people: readonly ExpensePerson[]): string {
  return people.find((p) => p.id === 'self')?.id ?? people[0]?.id ?? '';
}
