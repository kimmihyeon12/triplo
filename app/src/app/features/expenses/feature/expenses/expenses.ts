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
import { UiBadge } from '../../../../shared/ui/badge/badge';
import { UiNotice } from '../../../../shared/ui/notice/notice';
import { UiActionBar } from '../../../../shared/ui/action-bar/action-bar';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { UiEmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { UiRowMenu, type RowMenuItem } from '../../../../shared/ui/row-menu/row-menu';
import { UiTabs, type TabItem } from '../../../../shared/ui/tabs/tabs';
import { UiToast } from '../../../../shared/ui/toast/toast';
import { TripEditorStore } from '../../../trips/data/trip-editor-store';
import { estimatedCosts } from '../../../trips/util/estimated-cost';
import { LEDGER_REPOSITORY } from '../../data/ledger-repository';
import { LedgerSaver } from '../../data/ledger-saver';
import { expenseLinks } from '../../util/expense-link';
import { EXPENSE_CATEGORIES } from '../../model/ledger';
import { categoryStyle } from '../../model/category-style';
import type { Expense, Ledger } from '../../model/ledger';
import {
  personRemovalBlock,
  validateLedger,
  categoryBreakdown,
  duplicateTitleIds,
  newLedger,
  settlementText,
  transferSuggestions,
} from '../../util/ledger';
import { copyText } from '../../../places/data/map-links';
import { ExpenseForm } from '../../ui/expense-form/expense-form';
import { ReceiptScan } from '../../ui/receipt-scan/receipt-scan';
import { ToastService } from '../../../../core/toast-service';
import { myLedgerPersonId } from '../../../trips/util/sharing';
import { AuthStore } from '../../../auth/data/auth-store';

@Component({
  selector: 'app-expenses',
  templateUrl: './expenses.html',
  imports: [
    DecimalPipe,
    FormsModule,
    UiButton,
    UiInput,
    UiBadge,
    UiNotice,
    UiActionBar,
    IconComponent,
    UiEmptyState,
    UiRowMenu,
    UiTabs,
    UiToast,
    ExpenseForm,
    ReceiptScan,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Expenses {
  readonly id = input.required<string>();
  /** 일정·숙소 더보기의 '정산하기'가 넘겨주는 항목 id. 지출 기록을 열고 값을 채운다. */
  readonly add = input<string | undefined>();
  readonly store = inject(TripEditorStore);
  private readonly auth = inject(AuthStore);
  /** 가계부에서 나를 가리키는 칸. 합류한 친구의 기본 결제자가 주인이 되지 않게 한다. */
  readonly me = computed(() => {
    const trip = this.store.current();
    return trip ? myLedgerPersonId(trip, this.auth.user()?.id ?? null) : 'self';
  });
  private readonly repository = inject(LEDGER_REPOSITORY);
  readonly saver = new LedgerSaver(this.repository);
  private readRequest = 0;
  readonly ledger = signal<Ledger>(newLedger());
  /**
   * 가계부를 읽어 온 여행 id. 폼은 이 값이 지금 여행과 같을 때만 그린다.
   * 읽기 전에 폼이 열리면 사람 목록이 비어 결제자·분담 대상 기본값을 채우지 못한다.
   */
  readonly loadedTrip = signal('');
  readonly error = signal('');
  readonly blocked = signal(false);
  readonly formOpen = signal(false);
  readonly scanOpen = signal(false);
  /** 여행 날짜가 없을 때 사진 항목에 채울 날짜. */
  readonly today = new Date().toLocaleDateString('sv-SE');
  readonly editing = signal<Expense | null>(null);
  readonly deleteId = signal('');
  readonly personName = signal('');
  readonly tab = signal<'expenses' | 'settlement'>('expenses');
  readonly receiving = signal<{ from: string; to: string; amount: number } | null>(null);
  readonly receiptAmount = signal<number | null>(null);
  readonly cancelling = signal('');
  readonly cancelReason = signal('');
  /** 하단 버튼을 누른 손가락 근처에서도 결과가 보이도록 버튼 글자를 잠시 바꾼다. */
  private readonly toast = inject(ToastService);
  readonly actual = computed(() => this.ledger().expenses.reduce((n, e) => n + e.amount, 0));
  readonly estimate = computed(() =>
    this.store.current() ? estimatedCosts(this.store.current()!) : { total: 0, unknown: 0 },
  );
  readonly links = computed(() =>
    expenseLinks(this.store.current()?.stops ?? [], this.store.current()?.stays ?? []),
  );
  readonly transfers = computed(() => transferSuggestions(this.ledger()));
  /** 이름이 겹치는 지출. 목록에서 라벨로 알린다. */
  readonly duplicateIds = computed(() => duplicateTitleIds(this.ledger().expenses));

  constructor() {
    const bar = inject(PageBar);
    effect(() => {
      bar.set({ title: '여행 정산', back: ['/trips', this.id()], action: null });
      void this.store.open(this.id());
      // 일정 더보기의 '정산하기'로 들어오면 지출 기록을 펼친 채로 시작한다.
      this.formOpen.set(!!this.add());
      this.editing.set(null);
      this.blocked.set(false);
      this.error.set('');
      void this.load(this.id());
    });
  }

  person(id: string): string {
    return this.ledger().people.find((p) => p.id === id)?.name ?? '알 수 없음';
  }

  /** 가계부를 읽는다. 여행을 빠르게 옮겨 다니면 늦게 온 이전 여행의 결과는 버린다. */
  private async load(tripId: string): Promise<void> {
    const request = ++this.readRequest;
    try {
      const ledger = await this.repository.read(tripId);
      if (request !== this.readRequest) return;
      this.ledger.set(ledger);
      this.loadedTrip.set(tripId);
    } catch (e) {
      if (request !== this.readRequest) return;
      this.blocked.set(true);
      this.error.set(e instanceof Error ? e.message : '기록을 읽지 못했어요.');
    }
  }

  /**
   * 바뀐 가계부를 저장한다. 가계부 전체가 아니라 바뀐 동작만 서버에 보낸다
   * (친구가 동시에 지출을 더해도 막히지 않게). 저장 중에 다시 누르면 무시하고,
   * 실패하면 알린 뒤 서버에 남은 가계부로 화면을 맞춘다.
   */
  async persist(next: Ledger): Promise<boolean> {
    if (this.blocked()) return false;
    const invalid = validateLedger(next);
    if (invalid) {
      this.error.set(invalid);
      return false;
    }
    const result = await this.saver.save(this.id(), this.ledger(), next);
    if (result.status === 'busy') return false;
    // 저장 중에 시작된 읽기가 늦게 도착해 결과를 덮지 않게 한다.
    this.readRequest++;
    if (result.status === 'saved') {
      this.ledger.set(result.ledger);
      this.error.set('');
      return true;
    }
    this.error.set(result.error);
    if (result.ledger) this.ledger.set(result.ledger);
    // 다른 사람이 먼저 고쳤으면 열린 폼을 서버본으로 다시 채운다. 옛 값을 그대로 두면
    // 같은 저장을 다시 눌렀을 때 동료의 변경을 덮는다(2026-09-30 감리 P1-03).
    const open = this.editing();
    if (result.conflict && open && result.ledger) {
      const latest = result.ledger.expenses.find((e) => e.id === open.id) ?? null;
      this.editing.set(latest);
      if (!latest) this.formOpen.set(false);
      this.error.set(
        latest
          ? '다른 사람이 먼저 이 지출을 고쳤어요. 최신 내용으로 다시 열었으니 확인하고 다시 저장해 주세요.'
          : '다른 사람이 이 지출을 지웠어요.',
      );
    }
    return false;
  }

  addPerson(): void {
    const name = this.personName().trim();
    if (!name) return;
    void this.persist({
      ...this.ledger(),
      people: [...this.ledger().people, { id: crypto.randomUUID(), name }],
    }).then((ok) => {
      if (ok) this.personName.set('');
    });
  }

  /** 정산할 사람을 지운다. 기록에 있는 사람이면 지우지 않고 이유를 알린다. */
  removePerson(id: string): void {
    const blocked = personRemovalBlock(this.ledger(), id);
    if (blocked) {
      this.error.set(blocked);
      return;
    }
    void this.persist({ ...this.ledger(), people: this.ledger().people.filter((p) => p.id !== id) });
  }

  /** 행마다 버튼을 늘어놓지 않고 더보기 한 곳에 모은다. */
  /** 목록이 쌓이기만 하면 찾기 어렵다. 최근 지출을 위에 두고 분류로 거른다. */
  readonly sortBy = signal<'date' | 'amount'>('date');
  readonly categoryFilter = signal('');

  readonly visibleExpenses = computed(() => {
    const filter = this.categoryFilter();
    const rows = this.ledger().expenses.filter((e) => !filter || e.category === filter);
    return [...rows].sort((a, b) =>
      this.sortBy() === 'amount' ? b.amount - a.amount : b.date.localeCompare(a.date),
    );
  });

  /** 걸러진 목록의 합계. 전체 합계와 다를 수 있어 따로 보여 준다. */
  readonly visibleTotal = computed(() =>
    this.visibleExpenses().reduce((n, e) => n + e.amount, 0),
  );

  /** 분류 필터에 쓸 목록. 실제로 기록된 분류만 담는다. */
  readonly usedCategories = computed(() => {
    const seen = new Set(this.ledger().expenses.map((e) => e.category));
    return Object.entries(EXPENSE_CATEGORIES).filter(([key]) => seen.has(key));
  });

  readonly tabItems: readonly TabItem[] = [
    { id: 'expenses', label: '지출 내역' },
    { id: 'settlement', label: '정산 현황' },
  ];
  readonly expenseMenu: readonly RowMenuItem[] = [
    { id: 'edit', label: '수정', icon: 'edit' },
    { id: 'delete', label: '삭제', icon: 'trash', danger: true },
  ];
  readonly receiptMenu: readonly RowMenuItem[] = [
    { id: 'cancel', label: '기록 취소', icon: 'x', danger: true },
  ];

  readonly style = categoryStyle;
  readonly breakdown = computed(() => categoryBreakdown(this.ledger().expenses));
  readonly breakdownLabel = computed(
    () =>
      '분류별 지출: ' +
      this.breakdown()
        .map((r) => `${this.categoryLabel(r.category)} ${r.amount.toLocaleString('ko-KR')}원`)
        .join(', '),
  );

  /** 목록에서는 연도를 빼고 '5/1'처럼 줄여 쓴다. 여행 안의 지출이라 연도가 같다. */
  shortDate(date: string): string {
    const [, m, d] = date.split('-');
    return m && d ? `${Number(m)}/${Number(d)}` : date;
  }

  categoryLabel(key: string): string {
    return (EXPENSE_CATEGORIES as Record<string, string>)[key] ?? '기타';
  }

  onExpenseMenu(action: string, expense: Expense): void {
    if (action === 'edit') this.openExpense(expense);
    else if (action === 'delete') this.deleteId.set(expense.id);
  }

  openExpense(expense: Expense | null = null): void {
    this.editing.set(expense);
    this.formOpen.set(true);
  }

  openScan(): void {
    this.scanOpen.set(true);
  }

  /**
   * 사진에서 확인한 지출을 한 번에 더한다. 중간에 실패하면 앞선 건은 서버에 남으므로,
   * 다시 누르면 이미 저장된 건은 빼고 나머지만 보낸다.
   */
  saveScanned(expenses: Expense[]): void {
    const previous = this.ledger();
    const saved = new Set(previous.expenses.map((e) => e.id));
    const rest = expenses.filter((e) => !saved.has(e.id));
    void this.persist({ ...previous, expenses: [...previous.expenses, ...rest] }).then((ok) => {
      if (!ok) return;
      this.scanOpen.set(false);
      this.toast.success(`사진에서 ${expenses.length}건을 기록했어요.`);
    });
  }

  saveExpense(expense: Expense): void {
    const previous = this.ledger();
    const expenses = previous.expenses.some((e) => e.id === expense.id)
      ? previous.expenses.map((e) => (e.id === expense.id ? expense : e))
      : [...previous.expenses, expense];
    void this.persist({ ...previous, expenses }).then((ok) => {
      if (ok) this.formOpen.set(false);
    });
  }

  removeExpense(id: string): void {
    void this.persist({
      ...this.ledger(),
      expenses: this.ledger().expenses.filter((e) => e.id !== id),
    }).then((ok) => {
      if (ok) this.deleteId.set('');
    });
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
    void this.persist({
      ...this.ledger(),
      receipts: [
        ...this.ledger().receipts,
        { ...transfer, id: crypto.randomUUID(), amount, cancelledReason: null },
      ],
    }).then((ok) => {
      if (ok) this.receiving.set(null);
    });
  }

  async copySettlement(): Promise<void> {
    const ok = await copyText(settlementText(this.ledger()));
    if (ok) this.toast.success('복사했어요. 메신저에 붙여 넣어 보내 주세요.');
    else this.toast.error('복사하지 못했어요. 브라우저의 클립보드 권한을 확인해 주세요.');
  }

  /** 남은 정산을 한 번에 전액 수령으로 남긴다. 부분 수령은 개별 기록을 쓴다. */
  receiveAll(): void {
    const pending = this.transfers();
    if (pending.length === 0) return;
    void this.persist({
      ...this.ledger(),
      receipts: [
        ...this.ledger().receipts,
        ...pending.map((t) => ({ ...t, id: crypto.randomUUID(), cancelledReason: null })),
      ],
    });
  }

  cancelReceipt(): void {
    if (!this.cancelReason().trim()) {
      this.error.set('취소 이유를 입력해 주세요.');
      return;
    }
    void this.persist({
      ...this.ledger(),
      receipts: this.ledger().receipts.map((r) =>
        r.id === this.cancelling() ? { ...r, cancelledReason: this.cancelReason().trim() } : r,
      ),
    }).then((ok) => {
      if (!ok) return;
      this.cancelling.set('');
      this.cancelReason.set('');
    });
  }
}
