import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageBar } from '../../../../core/page-bar';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiInput } from '../../../../shared/ui/input/input';
import { ErrorToast } from '../../../../shared/ui/error-toast/error-toast';
import { TripEditorStore } from '../../../trips/data/trip-editor-store';
import { estimatedCosts } from '../../../trips/util/estimated-cost';
import { LocalLedger } from '../../data/local-ledger';
import type { Expense, Ledger } from '../../model/ledger';
import { newLedger, transferSuggestions } from '../../util/ledger';
import { ExpenseForm } from '../../ui/expense-form/expense-form';

@Component({
  selector: 'app-expenses',
  templateUrl: './expenses.html',
  imports: [DecimalPipe, FormsModule, UiButton, UiInput, ErrorToast, ExpenseForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Expenses {
  readonly id = input.required<string>();
  readonly store = inject(TripEditorStore);
  private readonly repository = inject(LocalLedger);
  readonly ledger = signal<Ledger>(newLedger());
  readonly error = signal('');
  readonly blocked = signal(false);
  readonly formOpen = signal(false);
  readonly editing = signal<Expense | null>(null);
  readonly deleteId = signal('');
  readonly personName = signal('');
  readonly tab = signal<'expenses' | 'settlement'>('expenses');
  readonly receiving = signal<{ from: string; to: string; amount: number } | null>(null);
  readonly receiptAmount = signal<number | null>(null);
  readonly cancelling = signal('');
  readonly cancelReason = signal('');
  readonly actual = computed(() => this.ledger().expenses.reduce((n, e) => n + e.amount, 0));
  readonly estimate = computed(() =>
    this.store.current() ? estimatedCosts(this.store.current()!) : { total: 0, unknown: 0 },
  );
  readonly links = computed(() => [
    ...(this.store.current()?.stops.filter((s) => !s.excluded) ?? []),
    ...(this.store.current()?.stays ?? []),
  ]);
  readonly transfers = computed(() => transferSuggestions(this.ledger()));

  constructor() {
    const bar = inject(PageBar);
    effect(() => {
      bar.set({ title: '여행 가계부', back: ['/trips', this.id()], action: null });
      void this.store.open(this.id());
      this.formOpen.set(false);
      this.blocked.set(false);
      this.error.set('');
      try {
        this.ledger.set(this.repository.read(this.id()));
      } catch (e) {
        this.blocked.set(true);
        this.error.set(e instanceof Error ? e.message : '기록을 읽지 못했어요.');
      }
    });
  }

  person(id: string): string {
    return this.ledger().people.find((p) => p.id === id)?.name ?? '알 수 없음';
  }

  persist(next: Ledger): boolean {
    if (this.blocked()) return false;
    try {
      this.repository.save(this.id(), next);
      this.ledger.set(next);
      this.error.set('');
      return true;
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : '이 기기에 저장하지 못했어요.');
      return false;
    }
  }

  addPerson(): void {
    const name = this.personName().trim();
    if (!name) return;
    if (
      this.persist({
        ...this.ledger(),
        people: [...this.ledger().people, { id: crypto.randomUUID(), name }],
      })
    )
      this.personName.set('');
  }

  openExpense(expense: Expense | null = null): void {
    this.editing.set(expense);
    this.formOpen.set(true);
  }

  saveExpense(expense: Expense): void {
    const previous = this.ledger();
    const expenses = previous.expenses.some((e) => e.id === expense.id)
      ? previous.expenses.map((e) => (e.id === expense.id ? expense : e))
      : [...previous.expenses, expense];
    if (this.persist({ ...previous, expenses })) this.formOpen.set(false);
  }

  removeExpense(id: string): void {
    if (
      this.persist({
        ...this.ledger(),
        expenses: this.ledger().expenses.filter((e) => e.id !== id),
      })
    )
      this.deleteId.set('');
  }

  recordReceipt(): void {
    const transfer = this.receiving();
    const amount = this.receiptAmount();
    const current = this.transfers().find(
      (t) => t.from === transfer?.from && t.to === transfer?.to,
    );
    if (!transfer || !current || amount === null || amount <= 0 || amount > current.amount) {
      this.error.set('수령 금액은 남은 정산 금액 안에서 입력해 주세요.');
      return;
    }
    if (
      this.persist({
        ...this.ledger(),
        receipts: [
          ...this.ledger().receipts,
          { ...transfer, id: crypto.randomUUID(), amount, cancelledReason: null },
        ],
      })
    )
      this.receiving.set(null);
  }

  cancelReceipt(): void {
    if (!this.cancelReason().trim()) {
      this.error.set('취소 이유를 입력해 주세요.');
      return;
    }
    if (
      this.persist({
        ...this.ledger(),
        receipts: this.ledger().receipts.map((r) =>
          r.id === this.cancelling() ? { ...r, cancelledReason: this.cancelReason().trim() } : r,
        ),
      })
    ) {
      this.cancelling.set('');
      this.cancelReason.set('');
    }
  }
}
