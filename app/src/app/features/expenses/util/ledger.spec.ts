import { describe, expect, it } from 'vitest';
import {
  allocateEvenly,
  balances,
  duplicateTitleIds,
  transferSuggestions,
  validateLedger,
  newLedger,
} from './ledger';
import type { Expense } from '../model/ledger';

function expense(id: string, title: string): Expense {
  return {
    id,
    title,
    amount: 1000,
    date: '2026-09-15',
    category: 'other',
    paidBy: 'p1',
    splits: [],
    memo: '',
    linkId: null,
    personal: true,
  };
}

describe('지출명 중복', () => {
  it('같은 이름의 지출을 모두 표시하고, 앞뒤 공백·대소문자 차이는 같게 본다', () => {
    const ids = duplicateTitleIds([
      expense('a', '점심'),
      expense('b', ' 점심 '),
      expense('c', '저녁'),
    ]);
    expect([...ids].sort()).toEqual(['a', 'b']);
  });

  it('빈 이름은 중복으로 세지 않는다', () => {
    expect(duplicateTitleIds([expense('a', ''), expense('b', '  ')]).size).toBe(0);
  });
});

describe('공동 가계부', () => {
  it('원화 나머지를 안정된 대상 순서로 나누고 합계를 보존한다', () => {
    expect(allocateEvenly(10000, ['a', 'b', 'c'])).toEqual([
      { personId: 'a', amount: 3334 },
      { personId: 'b', amount: 3333 },
      { personId: 'c', amount: 3333 },
    ]);
  });

  it('다른 결제자·부담 대상의 순잔액과 부분 수령을 계산한다', () => {
    const ledger = newLedger();
    ledger.people = ['a', 'b', 'c'].map((id) => ({ id, name: id }));
    ledger.expenses = [
      {
        id: 'stay',
        title: '숙소',
        date: '2026-09-14',
        category: 'stay',
        amount: 180000,
        paidBy: 'a',
        splits: allocateEvenly(180000, ['a', 'b', 'c']),
        memo: '',
        linkId: null,
      },
      {
        id: 'meal',
        title: '식사',
        date: '2026-09-14',
        category: 'food',
        amount: 60000,
        paidBy: 'b',
        splits: allocateEvenly(60000, ['a', 'b']),
        memo: '',
        linkId: null,
      },
    ];
    expect(validateLedger(ledger)).toBeNull();
    expect(balances(ledger)).toEqual({ a: 90000, b: -30000, c: -60000 });
    expect(transferSuggestions(ledger)).toEqual([
      { from: 'b', to: 'a', amount: 30000 },
      { from: 'c', to: 'a', amount: 60000 },
    ]);
    ledger.receipts = [{ id: 'r', from: 'b', to: 'a', amount: 10000, cancelledReason: null }];
    expect(balances(ledger)).toEqual({ a: 80000, b: -20000, c: -60000 });
    ledger.receipts[0].cancelledReason = '잘못 입력';
    expect(balances(ledger).b).toBe(-30000);
  });

  it('금액·부담액 합계·중복 사람을 검증한다', () => {
    const ledger = newLedger();
    ledger.people = [{ id: 'a', name: '나' }];
    ledger.expenses = [
      {
        id: 'e',
        title: '식사',
        date: '2026-09-14',
        category: 'food',
        amount: 100,
        paidBy: 'a',
        splits: [{ personId: 'a', amount: 99 }],
        memo: '',
        linkId: null,
      },
    ];
    expect(validateLedger(ledger)).toContain('합계');
    ledger.expenses[0].splits[0].amount = 100;
    ledger.expenses[0].amount = 1.5;
    expect(validateLedger(ledger)).toContain('정수');
    expect(() => allocateEvenly(10, ['a', 'a'])).toThrow();
  });
});
