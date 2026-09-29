import type { Expense, ExpensePerson, Ledger, SettlementReceipt } from '../model/ledger';

/**
 * 가계부를 서버에 저장하는 동작 한 건. 가계부 전체를 한 번에 저장하지 않고
 * 동작마다 저장해, 친구 여럿이 동시에 지출을 더해도 서로 막히지 않게 한다.
 */
export type LedgerOp =
  | { kind: 'addPerson'; person: ExpensePerson }
  | { kind: 'saveExpense'; expense: Expense; isNew: boolean }
  | { kind: 'deleteExpense'; id: string }
  | { kind: 'addReceipt'; receipt: SettlementReceipt }
  | { kind: 'cancelReceipt'; id: string; reason: string }
  | { kind: 'setBudget'; budget: number | null };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * 바꾸기 전/후 가계부의 차이를 동작 목록으로 바꾼다. 지출 화면의 저장과
 * 챗봇의 적용·되돌리기가 같은 함수를 쓴다. 사람·수령을 지우는 동작은 앱에
 * 없으므로 만들지 않는다.
 *
 * 순서: 사람 → 예산 → 지출 저장 → 지출 삭제 → 수령 취소 → 수령 추가.
 * 지출과 수령이 가리키는 사람이 먼저 있어야 서버의 외래 키가 맞는다.
 */
export function ledgerOps(before: Ledger, after: Ledger): LedgerOp[] {
  const ops: LedgerOp[] = [];
  const people = new Map(before.people.map((p) => [p.id, p]));
  for (const person of after.people) {
    const old = people.get(person.id);
    if (!old || old.name !== person.name) ops.push({ kind: 'addPerson', person });
  }
  if (before.budget !== after.budget) ops.push({ kind: 'setBudget', budget: after.budget });

  const expenses = new Map(before.expenses.map((e) => [e.id, e]));
  const kept = new Set(after.expenses.map((e) => e.id));
  for (const expense of after.expenses) {
    const old = expenses.get(expense.id);
    if (!old) ops.push({ kind: 'saveExpense', expense, isNew: true });
    else if (!same(old, expense)) ops.push({ kind: 'saveExpense', expense, isNew: false });
  }
  for (const expense of before.expenses)
    if (!kept.has(expense.id)) ops.push({ kind: 'deleteExpense', id: expense.id });

  const receipts = new Map(before.receipts.map((r) => [r.id, r]));
  for (const receipt of after.receipts) {
    const old = receipts.get(receipt.id);
    if (old && old.cancelledReason === null && receipt.cancelledReason !== null)
      ops.push({ kind: 'cancelReceipt', id: receipt.id, reason: receipt.cancelledReason });
  }
  for (const receipt of after.receipts)
    if (!receipts.has(receipt.id)) ops.push({ kind: 'addReceipt', receipt });
  return ops;
}

/** 동작 하나를 가계부에 적용한다. 기기 저장소와 서버 결과 반영에 쓴다. */
export function applyOp(ledger: Ledger, op: LedgerOp): Ledger {
  switch (op.kind) {
    case 'addPerson':
      return ledger.people.some((p) => p.id === op.person.id)
        ? { ...ledger, people: ledger.people.map((p) => (p.id === op.person.id ? op.person : p)) }
        : { ...ledger, people: [...ledger.people, op.person] };
    case 'saveExpense':
      return ledger.expenses.some((e) => e.id === op.expense.id)
        ? {
            ...ledger,
            expenses: ledger.expenses.map((e) => (e.id === op.expense.id ? op.expense : e)),
          }
        : { ...ledger, expenses: [...ledger.expenses, op.expense] };
    case 'deleteExpense':
      return { ...ledger, expenses: ledger.expenses.filter((e) => e.id !== op.id) };
    case 'addReceipt':
      return { ...ledger, receipts: [...ledger.receipts, op.receipt] };
    case 'cancelReceipt':
      return {
        ...ledger,
        receipts: ledger.receipts.map((r) =>
          r.id === op.id && r.cancelledReason === null ? { ...r, cancelledReason: op.reason } : r,
        ),
      };
    case 'setBudget':
      return { ...ledger, budget: op.budget };
  }
}
