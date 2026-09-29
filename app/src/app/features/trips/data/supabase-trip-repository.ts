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

  /**
   * 버전은 오르기만 한다. 저장 뒤 목록을 다시 읽을 때 저장보다 먼저 읽힌 응답이
   * 늦게 도착하면 버전을 낮춰, 다음 저장이 가짜 충돌로 거절됐다. 새로 불러올
   * 때는 forget으로 먼저 지운다.
   */
  private remember(row: TripRow): Trip {
    this.versions.set(row.id, Math.max(this.versions.get(row.id) ?? 0, row.version));
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
