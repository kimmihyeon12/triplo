import { describe, expect, it } from 'vitest';
import type { Expense, Ledger } from '../model/ledger';
import { applyOp, ledgerOps } from './ledger-ops';

function expense(id: string, amount = 10000): Expense {
  return {
    id,
    title: `지출 ${id}`,
    date: '2026-10-10',
    category: 'food',
    amount,
    paidBy: 'self',
    splits: [{ personId: 'self', amount }],
    memo: '',
    linkId: null,
    personal: false,
  };
}

const base: Ledger = {
  people: [{ id: 'self', name: '나' }],
  expenses: [expense('a'), expense('b')],
  receipts: [{ id: 'r1', from: 'p2', to: 'self', amount: 1000, cancelledReason: null }],
  budget: 50000,
};

describe('ledgerOps', () => {
  it('같으면 동작이 없다', () => {
    expect(ledgerOps(base, structuredClone(base))).toEqual([]);
  });

  it('사람·예산·지출·수령 차이를 정해진 순서의 동작으로 바꾼다', () => {
    const after: Ledger = {
      people: [{ id: 'self', name: '나나' }, { id: 'p2', name: '민지' }],
      expenses: [expense('a', 20000), expense('c')],
      receipts: [
        { ...base.receipts[0], cancelledReason: '실수' },
        { id: 'r2', from: 'self', to: 'p2', amount: 500, cancelledReason: null },
      ],
      budget: null,
    };
    expect(ledgerOps(base, after).map((op) => op.kind)).toEqual([
      'addPerson',
      'addPerson',
      'setBudget',
      'saveExpense',
      'saveExpense',
      'deleteExpense',
      'cancelReceipt',
      'addReceipt',
    ]);
    const ops = ledgerOps(base, after);
    expect(ops.find((op) => op.kind === 'saveExpense' && op.expense.id === 'a')).toMatchObject({ isNew: false });
    expect(ops.find((op) => op.kind === 'saveExpense' && op.expense.id === 'c')).toMatchObject({ isNew: true });
    expect(ops.find((op) => op.kind === 'deleteExpense')).toEqual({ kind: 'deleteExpense', id: 'b' });
  });

  it('동작을 차례로 적용하면 바뀐 가계부와 같아진다', () => {
    const after: Ledger = {
      people: [...base.people, { id: 'p2', name: '민지' }],
      expenses: [expense('a', 30000), expense('d')],
      receipts: [{ ...base.receipts[0], cancelledReason: '실수' }],
      budget: 70000,
    };
    const result = ledgerOps(base, after).reduce(applyOp, base);
    expect(JSON.stringify(result)).toBe(JSON.stringify(after));
  });

  it('빠진 사람은 다른 동작을 모두 마친 뒤 지운다', () => {
    const withFriend: Ledger = { ...base, people: [...base.people, { id: 'p3', name: '준호' }] };
    const after: Ledger = { ...base, expenses: [expense('a')] };
    const ops = ledgerOps(withFriend, after);
    expect(ops.at(-1)).toEqual({ kind: 'removePerson', id: 'p3' });
    expect(JSON.stringify(ops.reduce(applyOp, withFriend))).toBe(JSON.stringify(after));
  });

  it('되돌리기 방향이면 추가된 지출은 삭제가 된다', () => {
    const after: Ledger = { ...base, expenses: [...base.expenses, expense('new')] };
    expect(ledgerOps(after, base)).toEqual([{ kind: 'deleteExpense', id: 'new' }]);
  });
});
