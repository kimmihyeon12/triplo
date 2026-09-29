import type { SupabaseClient } from '@supabase/supabase-js';
import type { Trip } from '../model/trip';
import { TRIP_SELECT, type TripRow } from './trip-rows';

/** Supabase 호출을 이 좁은 창구 뒤에 둔다. 저장소 로직은 가짜로 테스트한다. */
export interface TripDataClient {
  listRows(): Promise<TripRow[]>;
  getRow(id: string): Promise<TripRow | null>;
  /** 저장하고 새 버전을 돌려준다. 버전이 어긋나면 TripConflictError. */
  saveTrip(trip: Trip, baseVersion: number): Promise<number>;
  deleteTrip(id: string): Promise<void>;
}

export class TripConflictError extends Error {
  constructor() {
    super('다른 곳에서 먼저 바뀌었어요. 새로 불러와 주세요.');
    this.name = 'TripConflictError';
  }
}

export class TripSaveError extends Error {
  constructor(message = '서버에 저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.') {
    super(message);
    this.name = 'TripSaveError';
  }
}

/** save_trip은 충돌을 SQLSTATE P0409로 알린다. 나머지는 사용자가 다시 시도할 일이다. */
export function toTripError(error: { code?: string; message?: string } | null): Error {
  if (error?.code === 'P0409') return new TripConflictError();
  return new TripSaveError();
}

export function supabaseTripDataClient(client: () => Promise<SupabaseClient>): TripDataClient {
  return {
    async listRows() {
      const { data, error } = await (await client())
        .from('trips')
        .select(TRIP_SELECT)
        .order('updated_at', { ascending: false });
      if (error) throw new TripSaveError('여행 목록을 불러오지 못했어요. 다시 시도해 주세요.');
      return (data ?? []) as TripRow[];
    },
    async getRow(id) {
      const { data, error } = await (await client())
        .from('trips')
        .select(TRIP_SELECT)
        .eq('id', id)
        .maybeSingle();
      if (error) throw new TripSaveError('여행을 불러오지 못했어요. 다시 시도해 주세요.');
      return (data as TripRow | null) ?? null;
    },
    async saveTrip(trip, baseVersion) {
      const { data, error } = await (await client()).rpc('save_trip', {
        p_trip: trip,
        p_base_version: baseVersion,
      });
      if (error) throw toTripError(error);
      return data as number;
    },
    // 표를 직접 지우지 않는다. 주인만 지울 수 있게 서버 함수가 확인한다.
    async deleteTrip(id) {
      const { error } = await (await client()).rpc('delete_trip', { p_trip_id: id });
      if (error) throw new TripSaveError('여행을 지우지 못했어요. 다시 시도해 주세요.');
    },
  };
}
