import { InjectionToken } from '@angular/core';
import type { Ledger } from '../model/ledger';
import type { LedgerOp } from '../util/ledger-ops';

/**
 * 가계부 저장 창구. 화면과 챗봇은 이 인터페이스만 쓴다. 실행 앱은 Supabase,
 * 테스트 앱은 기기 저장 구현을 쓴다.
 */
export interface LedgerRepository {
  /** 없으면 '나'만 있는 빈 가계부를 돌려준다. */
  read(tripId: string): Promise<Ledger>;
  /** 동작을 차례로 저장한다. 하나라도 실패하면 오류를 던진다. */
  apply(tripId: string, ops: readonly LedgerOp[]): Promise<void>;
}

export const LEDGER_REPOSITORY = new InjectionToken<LedgerRepository>('LEDGER_REPOSITORY');
