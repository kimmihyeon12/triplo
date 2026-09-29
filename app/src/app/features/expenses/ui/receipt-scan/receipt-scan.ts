import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiInput } from '../../../../shared/ui/input/input';
import { UiField } from '../../../../shared/ui/field/field';
import { UiCheckbox } from '../../../../shared/ui/checkbox/checkbox';
import { UiNotice } from '../../../../shared/ui/notice/notice';
import { UiSpinner } from '../../../../shared/ui/spinner/spinner';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { EXPENSE_CATEGORIES, type Expense, type ExpensePerson } from '../../model/ledger';
import { RECEIPT_SCANNER } from '../../data/receipt-scanner';
import { draftsToExpenses, type ReceiptDraft } from '../../util/receipt';
import { drawStrokes, fitSize, renderReceipt, type HighlightStroke } from '../../util/image';
import { AiQuota } from '../../../../core/ai-quota';
import { defaultPayer } from '../../util/expense-link';

type Step = 'pick' | 'mark' | 'scanning' | 'review';

/**
 * 사진으로 지출 입력.
 *
 * 사진을 고르면 모델이 항목을 모두 읽고, 사용자는 후보를 고치고 체크한
 * 것만 저장한다. 항목이 많은 긴 영수증은 사진 위에 형광펜을 칠해 읽을
 * 범위를 좁힌다. 모델이 낸 값은 이 화면에서 사용자가 확인하기 전에는
 * 저장하지 않는다.
 */
@Component({
  selector: 'app-receipt-scan',
  templateUrl: './receipt-scan.html',
  imports: [
    DecimalPipe,
    FormsModule,
    UiButton,
    UiInput,
    UiField,
    UiCheckbox,
    UiNotice,
    UiSpinner,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceiptScan {
  readonly people = input.required<ExpensePerson[]>();
  /** 가계부에서 나를 가리키는 칸. 합류한 친구는 'self'(주인)가 아니다. */
  readonly me = input('self');
  /** 사진에 날짜가 없을 때 채울 날짜. 보통 여행 첫날이다. */
  readonly fallbackDate = input.required<string>();
  readonly saved = output<Expense[]>();
  readonly cancelled = output<void>();

  private readonly scanner = inject(RECEIPT_SCANNER);
  readonly aiHint = inject(AiQuota).hint('receipt');
  readonly unavailable = this.scanner.unavailableReason();
  readonly categories = Object.entries(EXPENSE_CATEGORIES);

  readonly step = signal<Step>('pick');
  readonly error = signal('');
  readonly image = signal<HTMLImageElement | null>(null);
  readonly strokes = signal<HighlightStroke[]>([]);
  /** 켜 있을 때만 사진 위 끌기가 칠하기가 된다. 꺼 있으면 화면을 스크롤한다. */
  readonly marking = signal(false);

  readonly drafts = signal<ReceiptDraft[]>([]);
  readonly store = signal('');
  readonly total = signal(0);
  readonly dropped = signal(0);
  readonly paidBy = signal('self');
  readonly personal = signal(false);
  readonly merge = signal(false);
  readonly mergedTitle = signal('');

  readonly checkedCount = computed(() => this.drafts().filter((d) => d.checked).length);
  readonly checkedSum = computed(() =>
    this.drafts()
      .filter((d) => d.checked)
      .reduce((n, d) => n + (Number(d.amount) || 0), 0),
  );
  /** 전부 체크했는데 합이 영수증 합계와 다르면 빠진 줄이 있을 수 있다. */
  readonly totalMismatch = computed(
    () =>
      this.total() > 0 &&
      this.checkedCount() === this.drafts().length &&
      this.checkedSum() !== this.total(),
  );

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private objectUrl = '';
  private abort: AbortController | null = null;
  private drawing: { x: number; y: number }[] | null = null;

  constructor() {
    effect(() => {
      const image = this.image();
      const strokes = this.strokes();
      const canvas = this.canvas()?.nativeElement;
      if (!image || !canvas) return;
      const { width, height } = fitSize(image.width, image.height);
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(image, 0, 0, width, height);
      drawStrokes(ctx, strokes, width, height);
    });
    // 결제자 기본값은 나. 목록에 없으면(사람이 늦게 오거나 지워지면) 다시 고른다.
    let chosen = false;
    effect(() => {
      const people = this.people();
      if (!people.length) return;
      if (!chosen || !people.some((p) => p.id === this.paidBy())) {
        this.paidBy.set(defaultPayer(people, this.me()));
        chosen = true;
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.abort?.abort();
      if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    });
  }

  async choose(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    (event.target as HTMLInputElement).value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.error.set('사진 파일만 올릴 수 있어요.');
      return;
    }
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.src = this.objectUrl;
    try {
      await image.decode();
    } catch {
      this.error.set('사진을 열지 못했어요. 다른 사진을 골라 주세요.');
      return;
    }
    this.error.set('');
    this.strokes.set([]);
    this.marking.set(false);
    this.image.set(image);
    this.step.set('mark');
  }

  private point(event: PointerEvent): { x: number; y: number } {
    const rect = (event.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    return {
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height),
    };
  }

  startStroke(event: PointerEvent): void {
    if (!this.marking()) return;
    event.preventDefault();
    (event.currentTarget as HTMLCanvasElement).setPointerCapture?.(event.pointerId);
    this.drawing = [this.point(event)];
    this.strokes.update((s) => [...s, { points: this.drawing! }]);
  }

  moveStroke(event: PointerEvent): void {
    if (!this.drawing) return;
    this.drawing = [...this.drawing, this.point(event)];
    const points = this.drawing;
    this.strokes.update((s) => [...s.slice(0, -1), { points }]);
  }

  endStroke(): void {
    this.drawing = null;
  }

  undoStroke(): void {
    this.strokes.update((s) => s.slice(0, -1));
  }

  async scan(): Promise<void> {
    const image = this.image();
    if (!image) return;
    this.abort?.abort();
    const abort = (this.abort = new AbortController());
    this.error.set('');
    this.step.set('scanning');
    try {
      const highlighted = this.strokes().length > 0;
      const result = await this.scanner.scan(
        { base64: renderReceipt(image, this.strokes()), mimeType: 'image/jpeg', highlighted },
        abort.signal,
      );
      if (abort.signal.aborted) return;
      if (!result.drafts.length) {
        this.step.set('mark');
        this.error.set(
          '읽을 수 있는 결제 항목이 없었어요. 글자가 잘 보이는 사진으로 다시 올리거나 직접 입력해 주세요.',
        );
        return;
      }
      this.drafts.set(result.drafts);
      this.store.set(result.store);
      this.total.set(result.total);
      this.dropped.set(result.dropped);
      this.mergedTitle.set(result.store);
      this.merge.set(false);
      this.step.set('review');
    } catch (e) {
      if (abort.signal.aborted) return;
      this.step.set('mark');
      this.error.set(e instanceof Error ? e.message : '사진을 읽지 못했어요.');
    }
  }

  stopScan(): void {
    this.abort?.abort();
    this.step.set('mark');
  }

  patch(index: number, change: Partial<ReceiptDraft>): void {
    this.drafts.update((list) => list.map((d, i) => (i === index ? { ...d, ...change } : d)));
  }

  readonly allChecked = computed(() => this.drafts().every((d) => d.checked));

  toggleAll(): void {
    const next = !this.allChecked();
    this.drafts.update((list) => list.map((d) => ({ ...d, checked: next })));
  }

  save(): void {
    const chosen = this.drafts().filter((d) => d.checked);
    if (!chosen.length) {
      this.error.set('저장할 항목을 하나 이상 체크해 주세요.');
      return;
    }
    const invalid = chosen.some(
      (d) =>
        !d.title.trim() ||
        !Number.isInteger(Number(d.amount)) ||
        Number(d.amount) <= 0 ||
        (d.date !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(d.date)),
    );
    if (invalid) {
      this.error.set('체크한 항목의 이름과 1원 이상 금액을 확인해 주세요.');
      return;
    }
    if (this.merge() && !this.mergedTitle().trim()) {
      this.error.set('합쳐서 저장할 지출명을 입력해 주세요.');
      return;
    }
    try {
      this.saved.emit(
        draftsToExpenses(
          this.drafts().map((d) => ({ ...d, amount: Number(d.amount) })),
          {
            people: this.people(),
            paidBy: this.paidBy(),
            personal: this.personal(),
            merge: this.merge(),
            mergedTitle: this.mergedTitle(),
            fallbackDate: this.fallbackDate(),
          },
        ),
      );
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : '입력을 확인해 주세요.');
    }
  }
}
