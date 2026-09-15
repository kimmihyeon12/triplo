import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiInput } from '../../../../shared/ui/input/input';
import { UiField } from '../../../../shared/ui/field/field';
import { UiCheckbox } from '../../../../shared/ui/checkbox/checkbox';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import type { Expense, ExpensePerson } from '../../model/ledger';
import { EXPENSE_CATEGORIES } from '../../model/ledger';
import { allocateEvenly, expenseKey } from '../../util/ledger';

export interface ExpenseLink {
  id: string;
  name: string;
  estimatedCost?: number | null;
}

@Component({
  selector: 'app-expense-form',
  templateUrl: './expense-form.html',
  imports: [FormsModule, UiButton, UiInput, UiField, UiCheckbox, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpenseForm {
  readonly people = input.required<ExpensePerson[]>();
  readonly links = input<ExpenseLink[]>([]);
  readonly initial = input<Expense | null>(null);
  /** 일정에서 바로 넘어온 경우 채워 둘 항목 id. 새 지출일 때만 쓴다. */
  readonly prefillLinkId = input<string | undefined>();
  /** 중복 확인에 쓸 기존 지출. 저장은 막지 않고 알리기만 한다. */
  readonly existing = input<Expense[]>([]);
  readonly saved = output<Expense>();
  readonly cancelled = output<void>();
  readonly categories = Object.entries(EXPENSE_CATEGORIES);
  readonly title = signal('');
  readonly amount = signal<number | null>(null);
  readonly date = signal('');
  readonly category = signal('other');
  readonly paidBy = signal('self');
  readonly linkId = signal('');
  readonly personal = signal(false);
  readonly custom = signal(false);
  readonly selected = signal<string[]>([]);
  readonly shares = signal<Partial<Record<string, number>>>({});
  readonly memo = signal('');
  readonly error = signal('');

  constructor() {
    effect(() => {
      const e = this.initial();
      const people = untracked(this.people);
      this.title.set(e?.title ?? '');
      this.amount.set(e?.amount ?? null);
      const today = new Date();
      this.date.set(
        e?.date ??
          `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
      );
      this.category.set(e?.category ?? 'other');
      this.paidBy.set(e?.paidBy ?? people[0]?.id ?? '');
      this.linkId.set(e?.linkId ?? '');
      this.personal.set(e?.personal ?? false);
      this.selected.set(e?.splits.map((s) => s.personId) ?? people.map((p) => p.id));
      this.shares.set(Object.fromEntries(e?.splits.map((s) => [s.personId, s.amount]) ?? []));
      this.custom.set(!!e && !e.personal);
      this.memo.set(e?.memo ?? '');

    });

    /*
     * 일정에서 바로 넘어온 경우를 채운다. 여행 자료는 뒤늦게 도착하므로
     * links를 읽어 두고 항목이 실제로 생긴 뒤 한 번만 채운다.
     */
    let prefilled = '';
    effect(() => {
      const prefill = this.prefillLinkId();
      const link = prefill ? this.links().find((l) => l.id === prefill) : undefined;
      if (!link || prefilled === prefill || untracked(this.initial)) return;
      prefilled = prefill!;
      untracked(() => this.chooseLink(link.id));
      queueMicrotask(() => this.focusAmount());
    });
  }

  private focusAmount(): void {
    const el = document.getElementById('expense-amount');
    if (!(el instanceof HTMLInputElement)) return;
    el.focus();
    el.select();
  }

  /** 같은 이름이 이미 있으면 알린다. 저장은 막지 않는다. */
  readonly duplicateTitle = computed(() => {
    const key = expenseKey(this.title());
    if (!key) return false;
    const selfId = this.initial()?.id;
    return this.existing().some((e) => e.id !== selfId && expenseKey(e.title) === key);
  });

  chooseLink(id: string): void {
    this.linkId.set(id);
    const link = this.links().find((l) => l.id === id);
    if (link) {
      this.title.set(link.name);
      this.amount.set(link.estimatedCost ?? null);
    }
  }

  toggle(id: string): void {
    this.selected.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  /** 사람이 많을 때 하나씩 누르지 않도록 전체 선택을 둔다. */
  readonly allSelected = computed(() => {
    const people = this.people();
    return people.length > 0 && people.every((p) => this.selected().includes(p.id));
  });

  toggleAll(): void {
    this.selected.set(this.allSelected() ? [] : this.people().map((p) => p.id));
  }

  setShare(id: string, value: number): void {
    this.shares.update((s) => ({ ...s, [id]: value }));
  }

  submit(): void {
    try {
      const amount = this.amount() ?? 0;
      const splits = this.personal()
        ? []
        : this.custom()
          ? this.selected().map((personId) => ({ personId, amount: this.shares()[personId] ?? 0 }))
          : allocateEvenly(amount, this.selected());
      this.error.set('');
      this.saved.emit({
        id: this.initial()?.id ?? crypto.randomUUID(),
        title: this.title().trim(),
        amount,
        date: this.date(),
        category: this.category(),
        paidBy: this.paidBy(),
        splits,
        memo: this.memo(),
        linkId: this.linkId() || null,
        personal: this.personal(),
      });
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : '입력을 확인해 주세요.');
    }
  }
}
