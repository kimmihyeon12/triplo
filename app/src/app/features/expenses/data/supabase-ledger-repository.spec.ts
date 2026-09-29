import { describe, expect, it } from 'vitest';
import type { Expense } from '../model/ledger';
import { ledgerFromRows, type LedgerRows } from './ledger-rows';
import { SupabaseLedgerRepository } from './supabase-ledger-repository';
import { toLedgerError, type LedgerDataClient } from './ledger-data-client';
import { TripConflictError, TripSaveError } from '../../trips/data/trip-data-client';

const expense: Expense = {
  id: 'e1',
  title: '저녁',
  date: '2026-10-10',
  category: 'food',
  amount: 20000,
  paidBy: 'self',
  splits: [
    { personId: 'self', amount: 10000 },
    { personId: 'p2', amount: 10000 },
  ],
  memo: '',
  linkId: null,
  personal: false,
};

function rows(version = 3): LedgerRows {
  return {
    budget: 50000,
    people: [
      { id: 'p2', name: '민지', order: 1 },
      { id: 'self', name: '나', order: 0 },
    ],
    expenses: [
      {
        id: 'e1', title: '저녁', date: '2026-10-10', category: 'food', amount: 20000, paid_by: 'self',
        memo: '', link_id: null, personal: false, version, created_at: '2026-10-10T00:00:00Z',
        expense_splits: [
          { person_id: 'p2', amount: 10000 },
          { person_id: 'self', amount: 10000 },
        ],
      },
    ],
    receipts: [
      { id: 'r1', from_person: 'p2', to_person: 'self', amount: 5000, cancelled_reason: null, created_at: '2026-10-10T01:00:00Z' },
    ],
  };
}

function fakeClient(initial: LedgerRows) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  let current = initial;
  const client: LedgerDataClient = {
    read: async () => current,
    call: async (fn, args) => {
      calls.push({ fn, args });
      if (fn === 'save_expense') return (args['p_base_version'] as number) + 1;
      return null;
    },
  };
  return { calls, client, set: (r: LedgerRows) => (current = r) };
}

describe('ledgerFromRows', () => {
  it('사람 순서대로 정렬하고 분담도 사람 순서로 맞춘다', () => {
    const ledger = ledgerFromRows(rows());
    expect(ledger.people.map((p) => p.id)).toEqual(['self', 'p2']);
    expect(ledger.expenses[0]).toEqual(expense);
    expect(ledger.receipts[0]).toEqual({ id: 'r1', from: 'p2', to: 'self', amount: 5000, cancelledReason: null });
    expect(ledger.budget).toBe(50000);
  });
});

describe('SupabaseLedgerRepository', () => {
  it('나가 없으면 한 번 만들고 가계부에 넣는다', async () => {
    const { calls, client } = fakeClient({ budget: null, people: [], expenses: [], receipts: [] });
    const repo = new SupabaseLedgerRepository(client);
    const ledger = await repo.read('t1');
    expect(ledger.people).toEqual([{ id: 'self', name: '나' }]);
    expect(calls).toEqual([
      { fn: 'add_ledger_person', args: { p_trip_id: 't1', p_person: { id: 'self', name: '나' } } },
    ]);
  });

  it('수정은 읽은 버전을, 새 지출은 0을 보내고 돌려받은 버전을 기억한다', async () => {
    const { calls, client } = fakeClient(rows(3));
    const repo = new SupabaseLedgerRepository(client);
    await repo.read('t1');
    await repo.apply('t1', [{ kind: 'saveExpense', expense: { ...expense, amount: 20000 }, isNew: false }]);
    await repo.apply('t1', [{ kind: 'saveExpense', expense: { ...expense, id: 'e2' }, isNew: true }]);
    await repo.apply('t1', [{ kind: 'deleteExpense', id: 'e1' }]);
    expect(calls.map((c) => [c.fn, c.args['p_base_version']])).toEqual([
      ['save_expense', 3],
      ['save_expense', 0],
      ['delete_expense', 4],
    ]);
  });

  it('늦게 도착한 옛 읽기가 기억한 버전을 낮추지 않는다', async () => {
    const fake = fakeClient(rows(3));
    const repo = new SupabaseLedgerRepository(fake.client);
    await repo.read('t1');
    await repo.apply('t1', [{ kind: 'saveExpense', expense, isNew: false }]);
    fake.set(rows(3));
    await repo.read('t1');
    await repo.apply('t1', [{ kind: 'saveExpense', expense, isNew: false }]);
    expect(fake.calls.map((c) => c.args['p_base_version'])).toEqual([3, 4]);
  });

  it('예산·수령·사람 동작은 해당 함수로 보낸다', async () => {
    const { calls, client } = fakeClient(rows());
    const repo = new SupabaseLedgerRepository(client);
    await repo.apply('t1', [
      { kind: 'setBudget', budget: null },
      { kind: 'cancelReceipt', id: 'r1', reason: '실수' },
      { kind: 'addPerson', person: { id: 'p3', name: '준호' } },
      { kind: 'removePerson', id: 'p3' },
    ]);
    expect(calls).toEqual([
      { fn: 'set_budget', args: { p_trip_id: 't1', p_budget: null } },
      { fn: 'cancel_receipt', args: { p_trip_id: 't1', p_receipt_id: 'r1', p_reason: '실수' } },
      { fn: 'add_ledger_person', args: { p_trip_id: 't1', p_person: { id: 'p3', name: '준호' } } },
      { fn: 'remove_ledger_person', args: { p_trip_id: 't1', p_person_id: 'p3' } },
    ]);
  });
});

describe('toLedgerError', () => {
  it('P0409는 충돌, P0422는 분담 안내, 그 밖은 일반 실패다', () => {
    expect(toLedgerError({ code: 'P0409' })).toBeInstanceOf(TripConflictError);
    const split = toLedgerError({ code: 'P0422' });
    expect(split).toBeInstanceOf(TripSaveError);
    expect(split.message).toContain('분담 금액');
    expect(toLedgerError({ code: '42501' })).toBeInstanceOf(TripSaveError);
  });
});
