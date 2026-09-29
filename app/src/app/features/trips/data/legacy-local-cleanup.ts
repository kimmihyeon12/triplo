import type { KeyValueStorage } from './local-storage-trip-repository';

type ListableStorage = KeyValueStorage & { key(i: number): string | null; readonly length: number };

/**
 * 서버 저장으로 바꾼 뒤 기기에 남은 예전 여행과 그 가계부를 한 번 지운다
 * (2026-09-29 사용자 결정: 계정으로 옮기지 않음). 표시를 남겨 다시 돌지 않게
 * 한다. 표시 뒤에 새로 생긴 서버 여행의 가계부는 건드리지 않는다.
 */
export function clearLegacyLocalTrips(storage: ListableStorage, prefix: string): boolean {
  const marker = `${prefix}.migrated`;
  if (storage.getItem(marker) === 'server') return false;
  const doomed: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key === prefix || key?.startsWith(`${prefix}.ledger.`)) doomed.push(key);
  }
  for (const key of doomed) storage.removeItem(key);
  storage.setItem(marker, 'server');
  return true;
}
