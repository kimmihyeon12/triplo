import type { Trip } from '../model/trip';
import type { TripRepository } from './trip-repository';
import type { TripDataClient } from './trip-data-client';
import { tripFromRow, type TripRow } from './trip-rows';

/**
 * 로그인한 사람의 여행을 Supabase에 저장한다. 여행마다 마지막으로 본 서버
 * 버전을 기억해 저장할 때 보낸다. 모델(Trip)에는 버전을 넣지 않아 화면
 * 코드를 바꾸지 않는다.
 */
export class SupabaseTripRepository implements TripRepository {
  readonly lastSkippedCount = 0;
  private readonly versions = new Map<string, number>();

  constructor(private readonly data: TripDataClient) {}

  private remember(row: TripRow): Trip {
    this.versions.set(row.id, row.version);
    return tripFromRow(row);
  }

  async list(): Promise<Trip[]> {
    const rows = await this.data.listRows();
    return rows
      .map((r) => this.remember(r))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  }

  async get(id: string): Promise<Trip | null> {
    const row = await this.data.getRow(id);
    return row ? this.remember(row) : null;
  }

  async save(trip: Trip): Promise<void> {
    const next = await this.data.saveTrip(trip, this.versions.get(trip.id) ?? 0);
    this.versions.set(trip.id, next);
  }

  async remove(id: string): Promise<void> {
    await this.data.deleteTrip(id);
    this.versions.delete(id);
  }

  forget(id: string): void {
    this.versions.delete(id);
  }
}
