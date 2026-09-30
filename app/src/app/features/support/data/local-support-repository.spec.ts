import { describe, expect, it } from 'vitest';
import { LocalSupportRepository, type KeyValueStorage } from './local-support-repository';

function memory(): KeyValueStorage {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

describe('LocalSupportRepository', () => {
  // 같은 기기에서 계정을 바꾸면 이전 계정의 문의가 보였다(감리 P1-01).
  it('계정마다 다른 열쇠에 저장해 다른 계정의 문의를 읽지 않는다', async () => {
    const storage = memory();
    let account = 'a';
    const repo = new LocalSupportRepository(storage, () => `tc.support.${account}`);
    await repo.sendInquiry('bug', 'A의 문의');
    account = 'b';
    expect(await repo.inquiries()).toEqual([]);
    account = 'a';
    expect((await repo.inquiries()).map((i) => i.body)).toEqual(['A의 문의']);
  });
});
