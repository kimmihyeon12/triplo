import { describe, expect, it } from 'vitest';
import { clearLegacyLocalTrips } from './legacy-local-cleanup';

function memory(entries: Record<string, string>) {
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

describe('clearLegacyLocalTrips', () => {
  it('여행과 그 가계부를 지우고 표시를 남긴다. 다른 키는 둔다', () => {
    const s = memory({
      'tc.trips.v1': '{}',
      'tc.trips.v1.ledger.a': '{}',
      'tc.trips.v1.ledger.b': '{}',
      'tc.trips.v1.chat': '[]',
      'tc.auth.v1': 'x',
    });
    expect(clearLegacyLocalTrips(s, 'tc.trips.v1')).toBe(true);
    expect([...s.map.keys()].sort()).toEqual([
      'tc.auth.v1',
      'tc.trips.v1.chat',
      'tc.trips.v1.migrated',
    ]);
    expect(s.getItem('tc.trips.v1.migrated')).toBe('server');
  });

  it('이미 정리했으면 다시 지우지 않는다', () => {
    const s = memory({ 'tc.trips.v1.migrated': 'server', 'tc.trips.v1.ledger.new': '{}' });
    expect(clearLegacyLocalTrips(s, 'tc.trips.v1')).toBe(false);
    expect(s.getItem('tc.trips.v1.ledger.new')).toBe('{}');
  });
});
