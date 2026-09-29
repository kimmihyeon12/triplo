import type { KeyValueStorage } from '../../trips/data/local-storage-trip-repository';
import { TripSaveError } from '../../trips/data/trip-data-client';
import type { Ledger } from '../model/ledger';
import { newLedger, validateLedger } from '../util/ledger';
import { applyOp, type LedgerOp } from '../util/ledger-ops';
import type { LedgerRepository } from './ledger-repository';

/**
 * 기기에 가계부를 저장한다. 테스트 앱과 로그인 없는 미리보기가 쓴다.
 * 동작을 가계부에 적용하고 검사를 통과할 때만 통째로 저장한다.
 */
export class LocalLedgerRepository implements LedgerRepository {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly prefix: string,
  ) {}

  private key(tripId: string): string {
    return `${this.prefix}.ledger.${tripId}`;
  }

  async read(tripId: string): Promise<Ledger> {
    const raw = this.storage.getItem(this.key(tripId));
    if (!raw) return { ...newLedger(), people: [{ id: 'self', name: '나' }] };
    try {
      const value = JSON.parse(raw) as Ledger;
      if (validateLedger(value)) throw new Error();
      return value;
    } catch {
      throw new TripSaveError('가계부를 읽지 못했어요. 기존 기록을 보호하기 위해 저장을 멈췄어요.');
    }
  }

  async apply(tripId: string, ops: readonly LedgerOp[]): Promise<void> {
    const next = ops.reduce(applyOp, await this.read(tripId));
    const error = validateLedger(next);
    if (error) throw new TripSaveError(error);
    this.storage.setItem(this.key(tripId), JSON.stringify(next));
  }
}
