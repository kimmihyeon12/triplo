import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { UiButton } from '../button/button';
import { INPUT_CLASSES } from '../input/input.styles';
import { addDays, formatKoreanDate, isIsoDate } from '../../util/dates';

@Component({
  selector: 'app-temporal-picker',
  host: { class: 'contents' },
  templateUrl: './temporal-picker.html',
  imports: [UiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemporalPicker {
  readonly target = input.required<HTMLInputElement>();
  readonly rangeStart = input<HTMLInputElement | null>(null);
  readonly rangeEnd = input<HTMLInputElement | null>(null);
  readonly isRange = computed(() => !!this.rangeStart() && !!this.rangeEnd());
  readonly draftStart = signal('');
  readonly draftEnd = signal('');
  readonly pickingEnd = signal(false);
  readonly hovered = signal('');
  readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly cdr = inject(ChangeDetectorRef);
  readonly selectClasses = INPUT_CLASSES + ' select';
  readonly month = signal('');
  readonly selected = signal('');
  readonly focused = signal('');
  readonly hour = signal('09');
  readonly minute = signal('00');
  readonly second = signal('00');
  readonly error = signal('');
  readonly left = signal(0);
  readonly top = signal(0);
  readonly hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  readonly minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
  readonly weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  private readonly closeOnScroll = () => this.close(false);

  isDateTarget(): boolean {
    const el = this.target();
    return el.type === 'date' || el.dataset['nativeType'] === 'date';
  }
  readonly withSeconds = computed(
    () =>
      this.target().value.length > 5 ||
      (!!this.target().step && this.target().step !== 'any' && Number(this.target().step) < 60),
  );
  readonly monthLabel = computed(() => {
    const [y, m] = this.month().split('-');
    return `${y}년 ${Number(m)}월`;
  });
  readonly days = computed(() => {
    if (!this.month()) return [];
    const first = this.month() + '-01';
    const offset = new Date(first + 'T00:00:00Z').getUTCDay();
    return Array.from({ length: 42 }, (_, i) => {
      const date = addDays(first, i - offset);
      return { date, day: Number(date.slice(-2)), current: date.startsWith(this.month()) };
    });
  });

  open(): void {
    const el = this.target();
    this.draftStart.set(this.rangeStart()?.value ?? '');
    this.draftEnd.set(this.rangeEnd()?.value ?? '');
    this.pickingEnd.set(this.isRange() && el === this.rangeEnd() && isIsoDate(this.draftStart()));
    this.hovered.set('');
    const today = new Date();
    const fallback = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    let date = isIsoDate(el.value)
      ? el.value
      : isIsoDate(el.min) && el.min > fallback
        ? el.min
        : isIsoDate(el.max) && el.max < fallback
          ? el.max
          : fallback;
    if (isIsoDate(el.min) && date < el.min) date = el.min;
    if (isIsoDate(el.max) && date > el.max) date = el.max;
    this.month.set(date.slice(0, 7));
    this.focused.set(date);
    this.selected.set(el.value);
    this.error.set('');
    const [h, m, s] = (el.value || '09:00:00').split(':');
    this.hour.set(h);
    this.minute.set(m);
    this.second.set(s ?? '00');
    const rect = el.getBoundingClientRect();
    this.left.set(
      innerWidth < 720
        ? Math.max(8, (innerWidth - Math.min(320, innerWidth - 16)) / 2)
        : Math.max(8, Math.min(rect.left, innerWidth - 328)),
    );
    this.top.set(
      Math.max(
        8,
        Math.min(
          rect.bottom + 6,
          innerHeight - (this.isRange() ? 520 : this.isDateTarget() ? 420 : 250),
        ),
      ),
    );
    this.cdr.detectChanges();
    this.panel().nativeElement.showPopover();
    window.addEventListener('scroll', this.closeOnScroll, true);
    el.setAttribute('aria-expanded', 'true');
    queueMicrotask(() =>
      this.panel()
        .nativeElement.querySelector<HTMLElement>(
          this.isDateTarget() ? `[data-date="${date}"]` : 'select',
        )
        ?.focus(),
    );
  }

  available(date: string): boolean {
    const el = this.isRange()
      ? this.pickingEnd()
        ? this.rangeEnd()!
        : this.rangeStart()!
      : this.target();
    return (!el.min || date >= el.min) && (!el.max || date <= el.max);
  }

  rangeDateLabel(date: string): string {
    return date ? formatKoreanDate(date) : '날짜 선택';
  }

  isSelected(date: string): boolean {
    return this.isRange()
      ? date === this.draftStart() || date === this.draftEnd()
      : date === this.selected();
  }

  inRange(date: string): boolean {
    const end = this.draftEnd() || (this.pickingEnd() ? this.hovered() : '');
    return (
      this.isRange() && !!this.draftStart() && !!end && date >= this.draftStart() && date <= end
    );
  }

  highlightedEnd(): string {
    return this.draftEnd() || (this.pickingEnd() ? this.hovered() : '');
  }

  chooseDate(date: string): void {
    if (!this.isRange()) {
      this.commit(date);
      return;
    }
    if (!this.pickingEnd() || !this.draftStart() || date < this.draftStart()) {
      this.draftStart.set(date);
      this.draftEnd.set('');
      this.pickingEnd.set(true);
      this.focused.set(date);
      this.hovered.set('');
      return;
    }
    this.draftEnd.set(date);
    this.commitRange(this.draftStart(), date);
  }

  private commitRange(start: string, end: string): void {
    const first = this.rangeStart()!;
    const last = this.rangeEnd()!;
    if (
      first.disabled ||
      last.disabled ||
      (first.readOnly && !first.dataset['customPicker']) ||
      (last.readOnly && !last.dataset['customPicker'])
    )
      return;
    const previous = [first.value, last.value];
    first.value = start;
    last.value = end;
    if (!first.validity.valid || !last.validity.valid) {
      first.value = previous[0];
      last.value = previous[1];
      this.error.set('선택 가능한 기간을 확인해 주세요.');
      return;
    }
    for (const element of [first, last]) {
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
    this.close();
  }

  clear(): void {
    if (this.isRange()) this.commitRange('', '');
    else this.commit('');
  }

  moveMonth(amount: number): void {
    const [y, m] = this.month().split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1 + amount, 1));
    if (date.getUTCFullYear() < 100 || date.getUTCFullYear() > 9999) return;
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const el = this.target();
    if ((el.min && month < el.min.slice(0, 7)) || (el.max && month > el.max.slice(0, 7))) return;
    this.month.set(month);
    this.focused.set(el.min && el.min.startsWith(month) ? el.min : month + '-01');
  }

  onDayKey(event: KeyboardEvent, date: string): void {
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    const next = addDays(date, offsets[event.key]);
    if (!this.available(next)) return;
    this.month.set(next.slice(0, 7));
    this.focused.set(next);
    this.cdr.detectChanges();
    this.panel().nativeElement.querySelector<HTMLElement>(`[data-date="${next}"]`)?.focus();
  }

  chooseTime(): void {
    this.commit(`${this.hour()}:${this.minute()}${this.withSeconds() ? ':' + this.second() : ''}`);
  }

  commit(value: string): void {
    const el = this.target();
    if (el.disabled || (el.readOnly && !el.dataset['customPicker'])) return;
    const previous = el.value;
    el.value = value;
    if (!el.validity.valid) {
      el.value = previous;
      this.error.set('입력 가능한 범위와 시간 간격을 확인해 주세요.');
      return;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    this.close();
  }

  onToggle(): void {
    this.target().setAttribute(
      'aria-expanded',
      String(this.panel().nativeElement.matches(':popover-open')),
    );
  }

  close(restoreFocus = true): void {
    window.removeEventListener('scroll', this.closeOnScroll, true);
    this.panel().nativeElement.hidePopover();
    if (restoreFocus) this.target().focus();
  }
}
