import { describe, expect, it } from 'vitest';
import { createTrip } from '../domain/model';
import { LocalStorageTripRepository, type KeyValueStorage } from './local-storage-trip-repository';

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>();
  failWrites = false;
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

const KEY = 'tc.spec.trips';

describe('LocalStorageTripRepository', () => {
  it('저장한 여행을 같은 키에서 다시 읽는다', async () => {
    const storage = new MemoryStorage();
    const repo = new LocalStorageTripRepository(storage, KEY);
    const trip = createTrip({ id: 't1', title: '강릉', startDate: '2026-05-01', endDate: '2026-05-02' });
    await repo.save(trip);
    const reopened = new LocalStorageTripRepository(storage, KEY);
    expect(await reopened.get('t1')).toEqual(trip);
    expect((await reopened.list()).map((t) => t.id)).toEqual(['t1']);
  });

  it('list는 최근 수정순으로 정렬한다', async () => {
    const repo = new LocalStorageTripRepository(new MemoryStorage(), KEY);
    await repo.save(createTrip({ id: 'old', updatedAt: '2026-01-01T00:00:00.000Z' }));
    await repo.save(createTrip({ id: 'new', updatedAt: '2026-02-01T00:00:00.000Z' }));
    expect((await repo.list()).map((t) => t.id)).toEqual(['new', 'old']);
  });

  it('remove는 해당 여행만 지운다', async () => {
    const repo = new LocalStorageTripRepository(new MemoryStorage(), KEY);
    await repo.save(createTrip({ id: 'a' }));
    await repo.save(createTrip({ id: 'b' }));
    await repo.remove('a');
    expect((await repo.list()).map((t) => t.id)).toEqual(['b']);
  });

  it('쓰기 실패는 예외로 전달하고 기존 데이터는 유지한다', async () => {
    const storage = new MemoryStorage();
    const repo = new LocalStorageTripRepository(storage, KEY);
    await repo.save(createTrip({ id: 'a', title: '원본' }));
    storage.failWrites = true;
    await expect(repo.save(createTrip({ id: 'a', title: '수정' }))).rejects.toThrow();
    storage.failWrites = false;
    expect((await repo.get('a'))?.title).toBe('원본');
  });

  it('손상된 항목은 건너뛰고 개수를 보고한다', async () => {
    const storage = new MemoryStorage();
    const good = createTrip({ id: 'good' });
    storage.setItem(KEY, JSON.stringify({ version: 1, trips: { good, bad: { id: 'bad', title: 42 } } }));
    const repo = new LocalStorageTripRepository(storage, KEY);
    expect((await repo.list()).map((t) => t.id)).toEqual(['good']);
    expect(repo.lastSkippedCount).toBe(1);
  });

  it('전체 JSON이 손상되면 읽기 오류를 던진다', async () => {
    const storage = new MemoryStorage();
    storage.setItem(KEY, '{not json');
    const repo = new LocalStorageTripRepository(storage, KEY);
    await expect(repo.list()).rejects.toThrow();
  });

  it('빈 저장소는 빈 목록이다', async () => {
    const repo = new LocalStorageTripRepository(new MemoryStorage(), KEY);
    expect(await repo.list()).toEqual([]);
    expect(await repo.get('nope')).toBeNull();
  });
});
