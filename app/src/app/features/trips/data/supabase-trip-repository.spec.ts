import { describe, expect, it } from 'vitest';
import { createTrip } from '../util/factories';
import type { Trip } from '../model/trip';
import type { TripRow } from './trip-rows';
import { SupabaseTripRepository } from './supabase-trip-repository';
import {
  TripAccessError,
  TripConflictError,
  TripSaveError,
  toTripError,
  type TripDataClient,
} from './trip-data-client';

function rowOf(trip: Trip, version: number): TripRow {
  return {
    id: trip.id,
    title: trip.title,
    start_date: trip.startDate,
    end_date: trip.endDate,
    status: 'draft',
    schema_version: 1,
    created_at: trip.createdAt,
    updated_at: trip.updatedAt,
    version,
    trip_regions: [],
    trip_stops: [],
    accommodation_stays: [],
  };
}

/** 서버 흉내: 버전이 맞을 때만 저장하고 1 올린다. */
function fakeServer() {
  const rows = new Map<string, { trip: Trip; version: number }>();
  const calls: number[] = [];
  const client: TripDataClient = {
    listRows: async () => [...rows.values()].map((r) => rowOf(r.trip, r.version)),
    getRow: async (id) => (rows.has(id) ? rowOf(rows.get(id)!.trip, rows.get(id)!.version) : null),
    saveTrip: async (trip, base) => {
      calls.push(base);
      const current = rows.get(trip.id)?.version ?? 0;
      if (current !== base) throw new TripConflictError();
      rows.set(trip.id, { trip, version: current + 1 });
      return current + 1;
    },
    deleteTrip: async (id) => void rows.delete(id),
  };
  return { rows, calls, client };
}

describe('SupabaseTripRepository', () => {
  it('새 여행은 버전 0으로, 그다음 저장은 돌려받은 버전으로 보낸다', async () => {
    const server = fakeServer();
    const repo = new SupabaseTripRepository(server.client);
    const trip = createTrip({ title: '강릉' });
    await repo.save(trip);
    await repo.save({ ...trip, title: '강릉 2' });
    expect(server.calls).toEqual([0, 1]);
  });

  it('불러온 여행은 서버 버전을 기억해 보낸다', async () => {
    const server = fakeServer();
    const trip = createTrip({ title: '강릉' });
    server.rows.set(trip.id, { trip, version: 5 });
    const repo = new SupabaseTripRepository(server.client);
    await repo.get(trip.id);
    await repo.save(trip);
    expect(server.calls).toEqual([5]);
  });

  it('다른 곳에서 먼저 저장했으면 충돌 오류를 던지고, forget 후 다시 읽으면 저장된다', async () => {
    const server = fakeServer();
    const trip = createTrip({ title: '강릉' });
    server.rows.set(trip.id, { trip, version: 1 });
    const repo = new SupabaseTripRepository(server.client);
    await repo.get(trip.id);
    server.rows.set(trip.id, { trip, version: 2 });
    await expect(repo.save(trip)).rejects.toBeInstanceOf(TripConflictError);
    repo.forget(trip.id);
    await repo.get(trip.id);
    await expect(repo.save(trip)).resolves.toBeUndefined();
  });

  it('저장 뒤 늦게 도착한 옛 목록 응답이 기억한 버전을 낮추지 않는다', async () => {
    const server = fakeServer();
    const trip = createTrip({ title: '강릉' });
    // 목록 조회가 저장보다 먼저 읽혀 버전 0을 돌려주는 경우를 흉내 낸다.
    const repo = new SupabaseTripRepository({
      ...server.client,
      listRows: async () => [rowOf(trip, 0)],
    });
    await repo.save(trip);
    await repo.list();
    await repo.save({ ...trip, title: '강릉 2' });
    expect(server.calls).toEqual([0, 1]);
  });

  it('목록을 못 읽으면 오류를 그대로 던진다', async () => {
    const server = fakeServer();
    const repo = new SupabaseTripRepository({
      ...server.client,
      listRows: async () => {
        throw new TripSaveError('연결 실패');
      },
    });
    await expect(repo.list()).rejects.toThrow('연결 실패');
  });

  it('목록은 최근 수정 순이다', async () => {
    const server = fakeServer();
    const a = { ...createTrip({ title: 'a' }), updatedAt: '2026-09-01T00:00:00Z' };
    const b = { ...createTrip({ title: 'b' }), updatedAt: '2026-09-02T00:00:00Z' };
    server.rows.set(a.id, { trip: a, version: 1 });
    server.rows.set(b.id, { trip: b, version: 1 });
    const repo = new SupabaseTripRepository(server.client);
    expect((await repo.list()).map((t) => t.title)).toEqual(['b', 'a']);
  });
});

describe('SupabaseTripRepository 멤버', () => {
  it('읽을 때 지금 로그인한 사람으로 역할을 정한다', async () => {
    const trip = createTrip({ id: 't1', title: '함께' });
    const client: TripDataClient = {
      listRows: async () => [
        {
          ...rowOf(trip, 1),
          owner_id: 'u-owner',
          trip_members: [
            { user_id: 'u-owner', role: 'owner', nickname: '주인', joined_at: '2026-09-29T00:00:00Z' },
            { user_id: 'u-me', role: 'editor', nickname: '나', joined_at: '2026-09-29T01:00:00Z' },
          ],
        },
      ],
      getRow: async () => null,
      saveTrip: async () => 1,
      deleteTrip: async () => undefined,
    };
    expect((await new SupabaseTripRepository(client, () => 'u-owner').list())[0].sharing?.role).toBe('owner');
    expect((await new SupabaseTripRepository(client, () => 'u-me').list())[0].sharing?.role).toBe('editor');
  });
});

describe('toTripError 접근', () => {
  it('P0404는 접근할 수 없다는 안내로 바꾼다', () => {
    const error = toTripError({ code: 'P0404', message: 'not_found' });
    expect(error).toBeInstanceOf(TripAccessError);
    expect(error.message).toContain('접근할 수 없어요');
  });
});

describe('toTripError', () => {
  it('P0409는 충돌, 그 밖은 일반 저장 실패다', () => {
    expect(toTripError({ code: 'P0409', message: 'conflict' })).toBeInstanceOf(TripConflictError);
    expect(toTripError({ code: '23505', message: 'duplicate key' })).toBeInstanceOf(TripSaveError);
    expect(toTripError(null)).toBeInstanceOf(TripSaveError);
  });
});
