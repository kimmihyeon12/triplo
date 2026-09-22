import { describe, expect, it } from 'vitest';
import { createTrip } from '../../trips/util/factories';
import { newLedger } from '../../expenses/util/ledger';
import { ledgerCommand } from './local-ledger-commands';

const trip = createTrip({id: 't'});
const ledger = {...newLedger(), people: [{id: 'self', name: '나'}]};
describe('local ledger commands', () => {
  it('previews a single-payer expense from an explicit amount', () => {
    const result = ledgerCommand('점심값 2만 원 추가해', trip, ledger, '2026-10-01')!;
    const expense = result.draft!.ledger!.after.expenses[0];
    expect(expense.amount).toBe(20000);
    expect(expense.date).toBe('2026-10-01');
    expect(expense.title).toBe('점심값');
    expect(ledger.expenses).toHaveLength(0);
  });
  it('does not infer a payer when several people exist', () => {
    expect(ledgerCommand('점심값 2만 원 추가해', trip, {...ledger, people: [...ledger.people, {id:'b',name:'친구'}]}, '2026-10-01')?.draft).toBeUndefined();
  });
  it('reports budget and calculates division without changing settlement', () => {
    expect(ledgerCommand('예산 얼마나 남았어?', trip, ledger)?.text).toContain('미정');
    expect(ledgerCommand('총비용 3명이 똑같이 나누면?', trip, ledger)?.text).toContain('0원');
  });
  it('rejects negative and ambiguous amounts', () => {
    expect(ledgerCommand('점심값 -2000원 추가해', trip, ledger)?.draft).toBeUndefined();
    expect(ledgerCommand('점심값 2만원 말고 3만원 추가해', trip, ledger)?.draft).toBeUndefined();
  });
});
