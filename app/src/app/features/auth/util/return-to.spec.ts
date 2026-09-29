import { describe, expect, it } from 'vitest';
import { rememberReturn, takeReturn } from './return-to';

function memory(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size;
    },
  };
}

describe('return-to', () => {
  it('합류 주소만 한 번 돌려주고 지운다', () => {
    const store = memory();
    rememberReturn('/join/ABCD-EFGH', store);
    expect(takeReturn(store)).toBe('/join/ABCD-EFGH');
    expect(takeReturn(store)).toBeNull();
  });

  it('합류 주소가 아니면 버린다', () => {
    for (const path of ['/trips', 'https://evil.example/join/x', '//evil.example/join/x', '/join/../trips', 'join/ABCD']) {
      const store = memory();
      rememberReturn(path, store);
      expect(takeReturn(store)).toBeNull();
    }
  });
});
