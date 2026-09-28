import type { Expense, ExpenseSplit, Ledger } from '../model/ledger';

export const validMoney = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000;

/** 지출명 비교 기준. 앞뒤 공백과 대소문자 차이는 같은 이름으로 본다. */
export function expenseKey(title: string): string {
  return title.trim().toLowerCase();
}

/**
 * 이름이 겹치는 지출의 id.
 * 같은 이름을 두 번 적는 일은 대개 실수지만 정당한 경우도 있어 막지 않고 알리기만 한다.
 */
export function duplicateTitleIds(expenses: readonly Expense[]): Set<string> {
  const byKey = new Map<string, string[]>();
  for (const e of expenses) {
    const key = expenseKey(e.title);
    if (!key) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), e.id]);
  }
  const out = new Set<string>();
  for (const ids of byKey.values()) if (ids.length > 1) for (const id of ids) out.add(id);
  return out;
}

export function newLedger(): Ledger {
  return { people: [], expenses: [], receipts: [], budget: null };
}

export function allocateEvenly(amount: number, ids: string[]): ExpenseSplit[] {
  if (!validMoney(amount) || !ids.length || new Set(ids).size !== ids.length)
    throw new Error('금액과 분담 대상을 확인해 주세요.');
  const each = Math.floor(amount / ids.length);
  return ids.map((personId, i) => ({ personId, amount: each + (i < amount % ids.length ? 1 : 0) }));
}

export function validateLedger(ledger: Ledger): string | null {
  if (ledger.budget !== null && !validMoney(ledger.budget))
    return '예산은 0 이상 정수 원화 금액으로 입력해 주세요.';
  const ids = new Set(ledger.people.map((p) => p.id));
  if (
    ids.size !== ledger.people.length ||
    ledger.people.some((p) => !p.name.trim() || p.name.length > 40)
  )
    return '참여자 이름과 중복을 확인해 주세요.';
  if (
    new Set(ledger.expenses.map((e) => e.id)).size !== ledger.expenses.length ||
    new Set(ledger.receipts.map((r) => r.id)).size !== ledger.receipts.length
  )
    return '중복된 기록이 있습니다.';
  for (const e of ledger.expenses) {
    if (!validMoney(e.amount) || e.amount === 0)
      return '지출은 1원 이상 정수 금액으로 입력해 주세요.';
    if (
      !e.title.trim() ||
      e.title.length > 100 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(e.date) ||
      !ids.has(e.paidBy)
    )
      return '지출명·날짜·결제자를 확인해 주세요.';
    if (e.personal) continue;
    if (
      !e.splits.length ||
      new Set(e.splits.map((s) => s.personId)).size !== e.splits.length ||
      e.splits.some((s) => !ids.has(s.personId) || !validMoney(s.amount))
    )
      return '분담 대상과 금액을 확인해 주세요.';
    if (e.splits.reduce((n, s) => n + s.amount, 0) !== e.amount)
      return '분담 금액 합계가 실제 지출과 일치해야 합니다.';
  }
  for (const r of ledger.receipts) {
    if (
      !ids.has(r.from) ||
      !ids.has(r.to) ||
      r.from === r.to ||
      !validMoney(r.amount) ||
      r.amount === 0
    )
      return '수령 기록의 대상과 금액을 확인해 주세요.';
    if (r.cancelledReason !== null && !r.cancelledReason.trim())
      return '취소 이유를 입력해 주세요.';
  }
  return null;
}

export function balances(ledger: Ledger): Record<string, number> {
  const result: Record<string, number> = Object.fromEntries(ledger.people.map((p) => [p.id, 0]));
  for (const e of ledger.expenses.filter((e) => !e.personal)) {
    result[e.paidBy] = (result[e.paidBy] ?? 0) + e.amount;
    for (const s of e.splits) result[s.personId] = (result[s.personId] ?? 0) - s.amount;
  }
  for (const r of ledger.receipts.filter((r) => r.cancelledReason === null)) {
    result[r.from] = (result[r.from] ?? 0) + r.amount;
    result[r.to] = (result[r.to] ?? 0) - r.amount;
  }
  return result;
}

export function transferSuggestions(
  ledger: Ledger,
): { from: string; to: string; amount: number }[] {
  const rows = Object.entries(balances(ledger));
  const debtors = rows.filter(([, n]) => n < 0).map(([id, n]) => ({ id, amount: -n }));
  const creditors = rows.filter(([, n]) => n > 0).map(([id, n]) => ({ id, amount: n }));
  const result: { from: string; to: string; amount: number }[] = [];
  for (const debtor of debtors)
    for (const creditor of creditors) {
      const amount = Math.min(debtor.amount, creditor.amount);
      if (amount > 0) {
        result.push({ from: debtor.id, to: creditor.id, amount });
        debtor.amount -= amount;
        creditor.amount -= amount;
      }
    }
  return result;
}

/**
 * 메신저에 붙여 넣을 정산 안내. 친구들은 앱을 열지 않고 이 글만 보므로
 * 총금액과 누가 누구에게 얼마를 보내면 되는지만 적는다. 여행 이름 같은
 * 머리글은 붙이지 않는다. 개인 지출은 총금액에서 뺀다.
 */
export function settlementText(ledger: Ledger): string {
  const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
  const name = (id: string) => ledger.people.find((p) => p.id === id)?.name ?? '알 수 없음';
  const shared = ledger.expenses.filter((e) => !e.personal).reduce((n, e) => n + e.amount, 0);
  const transfers = transferSuggestions(ledger);
  return [
    `총금액 ${won(shared)}`,
    ...(transfers.length
      ? transfers.map((t) => `${name(t.from)} → ${name(t.to)} ${won(t.amount)}`)
      : ['남은 정산 금액이 없어요.']),
  ].join('\n');
}

/** 요약 막대에 쓸 분류별 합계. 개인 지출도 실제로 쓴 돈이므로 포함한다. */
export function categoryBreakdown(
  expenses: readonly Expense[],
): { category: string; amount: number; ratio: number }[] {
  const total = expenses.reduce((n, e) => n + e.amount, 0);
  if (!total) return [];
  const sums = new Map<string, number>();
  for (const e of expenses) sums.set(e.category, (sums.get(e.category) ?? 0) + e.amount);
  return [...sums]
    .map(([category, amount]) => ({ category, amount, ratio: amount / total }))
    .sort((a, b) => b.amount - a.amount);
}
