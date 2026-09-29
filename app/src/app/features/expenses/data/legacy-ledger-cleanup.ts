import type { KeyValueStorage } from '../../trips/data/local-storage-trip-repository';

type ListableStorage = KeyValueStorage & { key(i: number): string | null; readonly length: number };

/**
 * 가계부를 서버에 저장하게 된 뒤 기기에 남은 가계부를 한 번 지운다(2026-09-29
 * 사용자 결정: 옮기지 않음). 여행 정리 표시(migrated)와 따로 둔다. 여행 정리 뒤에
 * 서버 여행에 새로 쓴 기기 가계부도 지워야 하기 때문이다.
 */
export function clearLegacyLocalLedgers(storage: ListableStorage, prefix: string): boolean {
  const marker = `${prefix}.ledgerMigrated`;
  if (storage.getItem(marker) === 'server') return false;
  // 표시를 먼저 남긴다. 지우다 실패해도 다음 실행에서 새 가계부까지 다시 지우지 않게 한다.
  storage.setItem(marker, 'server');
  const doomed: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(`${prefix}.ledger.`)) doomed.push(key);
  }
  for (const key of doomed) storage.removeItem(key);
  return true;
}
