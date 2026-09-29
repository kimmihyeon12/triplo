import type { Expense, ExpensePerson, Ledger, SettlementReceipt } from '../model/ledger';

/**
 * 가계부를 서버에 저장하는 동작 한 건. 가계부 전체를 한 번에 저장하지 않고
 * 동작마다 저장해, 친구 여럿이 동시에 지출을 더해도 서로 막히지 않게 한다.
 */
export type LedgerOp =
  | { kind: 'addPerson'; person: ExpensePerson }
  | { kind: 'removePerson'; id: string }
  | { kind: 'saveExpense'; expense: Expense; isNew: boolean }
  | { kind: 'deleteExpense'; id: string }
  | { kind: 'addReceipt'; receipt: SettlementReceipt }
  | { kind: 'cancelReceipt'; id: string; reason: string }
  | { kind: 'setBudget'; budget: number | null };

/** 필드 순서와 빠진 기본값을 맞춘 지출. 서버에서 다시 읽은 값과 비교할 때 쓴다. */
function canonical(e: Expense): Expense {
  return {
    id: e.id, title: e.title, date: e.date, category: e.category, amount: e.amount, paidBy: e.paidBy,
    splits: e.splits.map((s) => ({ personId: s.personId, amount: s.amount })),
    memo: e.memo, linkId: e.linkId, personal: e.personal ?? false,
  };
}

const same = (a: Expense, b: Expense) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/** 두 가계부가 저장할 차이 없이 같은지. 필드 순서·기본값 차이는 무시한다. */
export function sameLedger(a: Ledger, b: Ledger): boolean {
  return ledgerOps(a, b).length === 0 && ledgerOps(b, a).length === 0;
}

/**
 * 바꾸기 전/후 가계부의 차이를 동작 목록으로 바꾼다. 지출 화면의 저장과
 * 챗봇의 적용·되돌리기가 같은 함수를 쓴다. 수령을 지우는 동작은 앱에
 * 없으므로 만들지 않는다(취소만 있다).
 *
 * 순서: 사람 → 예산 → 지출 저장 → 지출 삭제 → 수령 취소 → 수령 추가 → 사람 삭제.
 * 지출과 수령이 가리키는 사람이 먼저 있어야 서버의 외래 키가 맞고,
 * 지우는 사람은 그를 가리키던 기록이 모두 정리된 뒤에 지워야 한다.
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
  const remaining = new Set(after.people.map((p) => p.id));
  for (const person of before.people)
    if (!remaining.has(person.id)) ops.push({ kind: 'removePerson', id: person.id });
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
    case 'removePerson':
      return { ...ledger, people: ledger.people.filter((p) => p.id !== op.id) };
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
