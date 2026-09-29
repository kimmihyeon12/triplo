import { describe, expect, it } from 'vitest';
import type { Expense, Ledger } from '../model/ledger';
import { applyOp, type LedgerOp } from '../util/ledger-ops';
import type { LedgerRepository } from './ledger-repository';
import { LedgerSaver } from './ledger-saver';

function expense(id: string): Expense {
  return {
    id, title: id, date: '2026-10-10', category: 'food', amount: 1000, paidBy: 'self',
    splits: [{ personId: 'self', amount: 1000 }], memo: '', linkId: null, personal: false,
  };
}

const empty: Ledger = { people: [{ id: 'self', name: '나' }], expenses: [], receipts: [], budget: null };

/** 서버처럼 동작을 하나씩 반영하고, failAt번째 동작에서 실패한다. */
function fakeServer(failAt = -1) {
  let saved = structuredClone(empty);
  let count = 0;
  let release: () => void = () => {};
  let hold = false;
  const repo: LedgerRepository = {
    read: async () => structuredClone(saved),
    apply: async (_id, ops: LedgerOp[]) => {
      if (hold) await new Promise<void>((r) => (release = r));
      for (const op of ops) {
        if (count++ === failAt) throw new Error('연결 끊김');
        saved = applyOp(saved, op);
      }
    },
  };
  return { repo, get: () => saved, holdNext: () => (hold = true), release: () => release() };
}

describe('LedgerSaver', () => {
  it('저장 중에 온 두 번째 저장은 보내지 않는다', async () => {
    const server = fakeServer();
    server.holdNext();
    const saver = new LedgerSaver(server.repo);
    const first = saver.save('t1', empty, { ...empty, expenses: [expense('a')] });
    expect(saver.saving()).toBe(true);
    const second = await saver.save('t1', empty, { ...empty, expenses: [expense('b')] });
    expect(second.status).toBe('busy');
    server.release();
    expect((await first).status).toBe('saved');
    expect(saver.saving()).toBe(false);
    expect(server.get().expenses.map((e) => e.id)).toEqual(['a']);
  });

  it('여러 건 중간에 실패하면 서버에 남은 가계부를 다시 읽어 돌려준다', async () => {
    const server = fakeServer(1);
    const saver = new LedgerSaver(server.repo);
    const result = await saver.save('t1', empty, { ...empty, expenses: [expense('a'), expense('b')] });
    expect(result).toMatchObject({ status: 'failed', error: '연결 끊김' });
    expect(result.status === 'failed' && result.ledger?.expenses.map((e) => e.id)).toEqual(['a']);
  });
});
