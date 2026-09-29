import type { SupabaseClient } from '@supabase/supabase-js';
import { TripAccessError, TripConflictError, TripSaveError } from '../../trips/data/trip-data-client';
import type { LedgerRows } from './ledger-rows';

/** Supabase 호출을 이 좁은 창구 뒤에 둔다. 저장소 로직은 가짜로 테스트한다. */
export interface LedgerDataClient {
  read(tripId: string): Promise<LedgerRows>;
  /** 저장 함수를 부르고 결과를 돌려준다. 실패는 앱 오류로 바꿔 던진다. */
  call(fn: string, args: Record<string, unknown>): Promise<unknown>;
}

/**
 * 가계부 함수의 오류 코드: P0409 충돌, P0404 접근 불가(빠진 멤버·보이지 않는 기록), P0422 분담 합계 불일치,
 * 23503 지우려는 사람을 다른 기기의 기록이 가리킴.
 */
export function toLedgerError(error: { code?: string } | null): Error {
  if (error?.code === 'P0409') return new TripConflictError();
  if (error?.code === 'P0404') return new TripAccessError();
  if (error?.code === 'P0422')
    return new TripSaveError('분담 금액 합계가 실제 지출과 일치해야 합니다.');
  if (error?.code === '23503')
    return new TripSaveError('지출·수령 기록에 있는 사람이라 지울 수 없어요. 새로 불러와 확인해 주세요.');
  return new TripSaveError();
}

export function supabaseLedgerDataClient(client: () => Promise<SupabaseClient>): LedgerDataClient {
  return {
    async read(tripId) {
      const db = await client();
      const [ledger, people, expenses, receipts] = await Promise.all([
        db.from('trip_ledgers').select('budget').eq('trip_id', tripId).maybeSingle(),
        db.from('ledger_people').select('id, name, order').eq('trip_id', tripId),
        db.from('expenses').select('*, expense_splits(person_id, amount)').eq('trip_id', tripId),
        db.from('settlement_receipts').select('*').eq('trip_id', tripId),
      ]);
      if (ledger.error || people.error || expenses.error || receipts.error)
        throw new TripSaveError('가계부를 불러오지 못했어요. 다시 시도해 주세요.');
      return {
        budget: (ledger.data as { budget: number | null } | null)?.budget ?? null,
        people: (people.data ?? []) as LedgerRows['people'],
        expenses: (expenses.data ?? []) as LedgerRows['expenses'],
        receipts: (receipts.data ?? []) as LedgerRows['receipts'],
      };
    },
    async call(fn, args) {
      const { data, error } = await (await client()).rpc(fn, args);
      if (error) throw toLedgerError(error);
      return data;
    },
  };
}
