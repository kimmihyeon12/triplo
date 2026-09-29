import { signal } from '@angular/core';
import type { Ledger } from '../model/ledger';
import { ledgerOps } from '../util/ledger-ops';
import type { LedgerRepository } from './ledger-repository';

export type LedgerSaveResult =
  | { status: 'saved'; ledger: Ledger }
  | { status: 'busy' }
  /** ledger는 실패 뒤 다시 읽은 서버본이다. 다시 읽지도 못했으면 null. */
  | { status: 'failed'; error: string; ledger: Ledger | null };

/**
 * 지출 화면의 가계부 저장을 맡는다. 동작을 한 건씩 보내므로 두 가지를 지킨다.
 * - 저장이 끝나기 전의 두 번째 저장은 보내지 않는다. 두 번 누르면 같은 지출이 두 번 생긴다.
 * - 실패하면 서버에 무엇이 남았는지 다시 읽는다. 여러 건 중 일부만 저장된 채
 *   화면이 옛 상태로 남으면, 다시 시도할 때 앞선 건이 한 번 더 저장된다.
 */
export class LedgerSaver {
  readonly saving = signal(false);

  constructor(private readonly repository: LedgerRepository) {}

  async save(tripId: string, before: Ledger, next: Ledger): Promise<LedgerSaveResult> {
    if (this.saving()) return { status: 'busy' };
    this.saving.set(true);
    try {
      await this.repository.apply(tripId, ledgerOps(before, next));
      return { status: 'saved', ledger: next };
    } catch (e) {
      const error = e instanceof Error ? e.message : '저장하지 못했어요.';
      const ledger = await this.repository.read(tripId).catch(() => null);
      return { status: 'failed', error, ledger };
    } finally {
      this.saving.set(false);
    }
  }
}
