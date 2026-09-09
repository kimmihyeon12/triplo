import type { Trip } from '../domain/model';
import type { TripRepository } from './trip-repository';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface StoreFile {
  version: 1;
  trips: Record<string, unknown>;
}

function isTrip(value: unknown): value is Trip {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t['id'] === 'string' &&
    typeof t['title'] === 'string' &&
    Array.isArray(t['regions']) &&
    Array.isArray(t['stops']) &&
    Array.isArray(t['stays']) &&
    typeof t['updatedAt'] === 'string'
  );
}

/**
 * 같은 기기의 비회원 초안 저장소. 여행 하나를 통째로 저장한다.
 * 서버 동기화 기능은 여기에 구현하지 않는다.
 */
export class LocalStorageTripRepository implements TripRepository {
  lastSkippedCount = 0;

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly key: string,
    /** 테스트 앱 전용: 이 키에 값이 있으면 쓰기를 실패시킨다. */
    private readonly failFlagKey: string | null = null,
  ) {}

  private read(): Record<string, Trip> {
    const raw = this.storage.getItem(this.key);
    this.lastSkippedCount = 0;
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoreFile;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.trips !== 'object' || parsed.trips === null) {
      throw new Error('저장 형식을 읽을 수 없습니다.');
    }
    const out: Record<string, Trip> = {};
    for (const [id, value] of Object.entries(parsed.trips)) {
      if (isTrip(value)) out[id] = value;
      else this.lastSkippedCount++;
    }
    return out;
  }

  private write(trips: Record<string, Trip>): void {
    if (this.failFlagKey && this.storage.getItem(this.failFlagKey)) {
      throw new Error('테스트용 저장 실패');
    }
    const file: StoreFile = { version: 1, trips };
    this.storage.setItem(this.key, JSON.stringify(file));
  }

  async list(): Promise<Trip[]> {
    return Object.values(this.read()).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  }

  async get(id: string): Promise<Trip | null> {
    return this.read()[id] ?? null;
  }

  async save(trip: Trip): Promise<void> {
    const trips = this.read();
    trips[trip.id] = trip;
    this.write(trips);
  }

  async remove(id: string): Promise<void> {
    const trips = this.read();
    delete trips[id];
    this.write(trips);
  }
}
