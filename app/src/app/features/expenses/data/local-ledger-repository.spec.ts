import { describe, expect, it } from 'vitest';
import { LocalLedgerRepository } from './local-ledger-repository';
import { clearLegacyLocalLedgers } from './legacy-ledger-cleanup';
import { TripSaveError } from '../../trips/data/trip-data-client';

function memory(entries: Record<string, string> = {}) {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
    map,
  };
}

describe('LocalLedgerRepository', () => {
  it('처음 읽으면 나만 있는 빈 가계부다', async () => {
    const repo = new LocalLedgerRepository(memory(), 'tc.test.trips.v1');
    expect((await repo.read('t1')).people).toEqual([{ id: 'self', name: '나' }]);
  });

  it('동작을 적용해 저장하고 다시 읽으면 반영돼 있다', async () => {
    const storage = memory();
    const repo = new LocalLedgerRepository(storage, 'tc.test.trips.v1');
    await repo.apply('t1', [
      { kind: 'addPerson', person: { id: 'p2', name: '민지' } },
      { kind: 'setBudget', budget: 30000 },
    ]);
    const ledger = await repo.read('t1');
    expect(ledger.people.map((p) => p.name)).toEqual(['나', '민지']);
    expect(ledger.budget).toBe(30000);
    expect(storage.map.has('tc.test.trips.v1.ledger.t1')).toBe(true);
  });

  it('검사에 걸리는 동작은 저장하지 않고 오류를 던진다', async () => {
    const repo = new LocalLedgerRepository(memory(), 'tc.test.trips.v1');
    const bad = {
      id: 'e1', title: '저녁', date: '2026-10-10', category: 'food', amount: 1000, paidBy: 'self',
      splits: [{ personId: 'self', amount: 999 }], memo: '', linkId: null, personal: false,
    };
    await expect(repo.apply('t1', [{ kind: 'saveExpense', expense: bad, isNew: true }])).rejects.toBeInstanceOf(TripSaveError);
    expect((await repo.read('t1')).expenses).toEqual([]);
  });
});

describe('clearLegacyLocalLedgers', () => {
  it('가계부만 지우고 표시를 남기며, 두 번째에는 지우지 않는다', () => {
    const s = memory({ 'tc.trips.v1.ledger.a': '{}', 'tc.trips.v1.chat': '[]', 'tc.trips.v1.migrated': 'server' });
    expect(clearLegacyLocalLedgers(s, 'tc.trips.v1')).toBe(true);
    expect([...s.map.keys()].sort()).toEqual(['tc.trips.v1.chat', 'tc.trips.v1.ledgerMigrated', 'tc.trips.v1.migrated']);
    s.setItem('tc.trips.v1.ledger.b', '{}');
    expect(clearLegacyLocalLedgers(s, 'tc.trips.v1')).toBe(false);
    expect(s.getItem('tc.trips.v1.ledger.b')).toBe('{}');
  });
});
