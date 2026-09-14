import type { ExpenseSplit, Ledger } from '../model/ledger';

export const validMoney = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000;

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
