/**
 * 실행 앱이 문의를 서버에 저장하면서 기기에 남은 계정별 문의를 지운다
 * (2026-10-01 사용자 결정: 옮기지 않는다). 그 문의는 운영자에게 간 적이 없다.
 * 지운 개수를 돌려준다.
 */
export function clearLocalSupport(storage: Pick<Storage, 'length' | 'key' | 'removeItem'>, prefix: string): number {
  const target = `${prefix}.support.`;
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(target)) keys.push(key);
  }
  keys.forEach((k) => storage.removeItem(k));
  return keys.length;
}
