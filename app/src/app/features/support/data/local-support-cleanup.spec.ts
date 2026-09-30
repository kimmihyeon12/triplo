import { expect, it } from 'vitest';
import { clearLocalSupport } from './local-support-cleanup';

it('계정별 기기 문의만 지우고 다른 기록은 둔다', () => {
  const data = new Map([
    ['tc.trips.v1.support.u1', '{}'],
    ['tc.trips.v1.support.guest', '{}'],
    ['tc.trips.v1.chat.u1', '{}'],
    ['other', '1'],
  ]);
  const storage = {
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
  expect(clearLocalSupport(storage, 'tc.trips.v1')).toBe(2);
  expect([...data.keys()]).toEqual(['tc.trips.v1.chat.u1', 'other']);
});
