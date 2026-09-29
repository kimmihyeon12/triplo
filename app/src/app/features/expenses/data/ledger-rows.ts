import type { Expense, Ledger } from '../model/ledger';

/** Supabase 가계부 표의 행. 네 표를 따로 읽어 이 모양으로 모은다. */
export interface PersonRow {
  id: string;
  name: string;
  order: number;
}

export interface ExpenseRow {
  id: string;
  title: string;
  date: string;
  category: string;
  amount: number;
  paid_by: string;
  memo: string;
  link_id: string | null;
  personal: boolean;
  version: number;
  created_at: string;
  expense_splits: { person_id: string; amount: number }[];
}

export interface ReceiptRow {
  id: string;
  from_person: string;
  to_person: string;
  amount: number;
  cancelled_reason: string | null;
  created_at: string;
}

export interface LedgerRows {
  budget: number | null;
  people: PersonRow[];
  expenses: ExpenseRow[];
  receipts: ReceiptRow[];
}

/**
 * 행을 앱 가계부로 바꾼다. 분담은 사람 순서로 맞춘다. 서버는 순서를 보장하지
 * 않는데, 순서가 읽을 때마다 다르면 전/후 비교가 바뀌지 않은 지출을 바뀐 것으로 본다.
 */
export function ledgerFromRows(rows: LedgerRows): Ledger {
  const people = [...rows.people].sort((a, b) => a.order - b.order);
  const rank = new Map(people.map((p, i) => [p.id, i]));
  const byTime = <T extends { created_at: string }>(list: T[]) =>
    [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const expenses: Expense[] = byTime(rows.expenses).map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date,
    category: e.category,
    amount: e.amount,
    paidBy: e.paid_by,
    splits: [...e.expense_splits]
      .sort((a, b) => (rank.get(a.person_id) ?? 0) - (rank.get(b.person_id) ?? 0))
      .map((s) => ({ personId: s.person_id, amount: s.amount })),
    memo: e.memo,
    linkId: e.link_id,
    personal: e.personal,
  }));
  return {
    people: people.map((p) => ({ id: p.id, name: p.name })),
    expenses,
    receipts: byTime(rows.receipts).map((r) => ({
      id: r.id,
      from: r.from_person,
      to: r.to_person,
      amount: r.amount,
      cancelledReason: r.cancelled_reason,
    })),
    budget: rows.budget,
  };
}
