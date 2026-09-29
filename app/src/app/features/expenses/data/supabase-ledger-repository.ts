import type { Ledger } from '../model/ledger';
import type { LedgerOp } from '../util/ledger-ops';
import type { LedgerRepository } from './ledger-repository';
import type { LedgerDataClient } from './ledger-data-client';
import { ledgerFromRows } from './ledger-rows';

const SELF = { id: 'self', name: '나' };

/**
 * 로그인한 사람의 가계부를 Supabase에 동작 한 건씩 저장한다. 지출마다
 * 마지막으로 본 서버 버전을 기억해 수정·삭제에 보낸다. 여행 저장소와 같이
 * 버전은 오르기만 한다.
 */
export class SupabaseLedgerRepository implements LedgerRepository {
  private readonly versions = new Map<string, number>();

  constructor(private readonly data: LedgerDataClient) {}

  private remember(id: string, version: number): void {
    this.versions.set(id, Math.max(this.versions.get(id) ?? 0, version));
  }

  async read(tripId: string): Promise<Ledger> {
    const rows = await this.data.read(tripId);
    for (const e of rows.expenses) this.remember(e.id, e.version);
    const ledger = ledgerFromRows(rows);
    // 처음 여는 여행에는 '나'가 없다. 지출의 결제자가 되려면 서버에 있어야 한다.
    if (ledger.people.some((p) => p.id === SELF.id)) return ledger;
    await this.data.call('add_ledger_person', { p_trip_id: tripId, p_person: SELF });
    return { ...ledger, people: [SELF, ...ledger.people] };
  }

  async apply(tripId: string, ops: readonly LedgerOp[]): Promise<void> {
    for (const op of ops) {
      switch (op.kind) {
        case 'addPerson':
          await this.data.call('add_ledger_person', { p_trip_id: tripId, p_person: op.person });
          break;
        case 'saveExpense': {
          const base = op.isNew ? 0 : (this.versions.get(op.expense.id) ?? 0);
          const next = (await this.data.call('save_expense', {
            p_trip_id: tripId,
            p_expense: op.expense,
            p_base_version: base,
          })) as number;
          this.remember(op.expense.id, next);
          break;
        }
        case 'deleteExpense':
          await this.data.call('delete_expense', {
            p_trip_id: tripId,
            p_expense_id: op.id,
            p_base_version: this.versions.get(op.id) ?? 0,
          });
          this.versions.delete(op.id);
          break;
        case 'addReceipt':
          await this.data.call('add_receipt', { p_trip_id: tripId, p_receipt: op.receipt });
          break;
        case 'cancelReceipt':
          await this.data.call('cancel_receipt', {
            p_trip_id: tripId,
            p_receipt_id: op.id,
            p_reason: op.reason,
          });
          break;
        case 'setBudget':
          await this.data.call('set_budget', { p_trip_id: tripId, p_budget: op.budget });
          break;
      }
    }
  }
}
