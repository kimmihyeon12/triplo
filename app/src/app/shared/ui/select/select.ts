import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';
import { INPUT_CLASSES } from '../input/input.styles';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

/** 목록을 위로 열지 정할 때 아래에 필요한 최소 공간(px). */
const PANEL_MAX = 288;

let nextId = 0;

/**
 * 앱 공통 선택 상자(2026-10-02 사용자 결정: 상자 목록 통일, 시안 A).
 * 브라우저 기본 목록은 기기마다 모양이 다르고(아이폰 휠, 크롬 꾸민 목록) 크롬 버전에 따라
 * 항목이 골라지지 않는 문제도 있었다. 상자는 기존 입력 상자 모양 그대로, 목록은 앱이 그린다.
 *
 * - [(value)] 또는 [ngModel]로 쓴다. 값은 문자열이다.
 * - 키보드: 아래·위 화살표로 열고 옮기며, Enter·Space로 고르고, Esc·Tab으로 닫는다. Home·End도 된다.
 * - 바깥을 누르면 닫는다. 아래 공간이 모자라면 위로 연다.
 * - 각 항목은 `{testId}-option-{value}` 테스트 ID를 가진다.
 */
@Component({
  selector: 'app-select',
  templateUrl: './select.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block min-w-0', '(keydown)': 'onKeydown($event)' },
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiSelect), multi: true }],
})
export class UiSelect implements ControlValueAccessor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  readonly options = input.required<readonly SelectOption[]>();
  readonly value = model<string>('');
  readonly inputId = input<string>(`app-select-${++nextId}`);
  readonly ariaLabel = input<string | null>(null);
  readonly testId = input<string | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });
  /** 상자 크기·폭을 화면에 맞출 때 덧붙이는 클래스(예: 'w-auto! text-13!'). */
  readonly buttonClass = input('');
  /** 값이 목록에 없을 때 상자에 보일 글. */
  readonly placeholder = input('선택');
  readonly changed = output<string>();

  readonly classes = INPUT_CLASSES;
  readonly open = signal(false);
  readonly up = signal(false);
  readonly active = signal(-1);
  private readonly formDisabled = signal(false);
  readonly isDisabled = computed(() => this.disabled() || this.formDisabled());
  readonly listId = computed(() => `${this.inputId()}-list`);
  readonly selectedIndex = computed(() => this.options().findIndex((o) => o.value === this.value()));
  readonly label = computed(() => this.options()[this.selectedIndex()]?.label ?? this.placeholder());

  private readonly list = viewChild<ElementRef<HTMLElement>>('list');
  private onChange: (v: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    const onDocDown = (event: PointerEvent) => {
      if (this.open() && !this.host.contains(event.target as Node)) this.close();
    };
    document.addEventListener('pointerdown', onDocDown, true);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('pointerdown', onDocDown, true));
  }

  toggle(): void {
    if (this.open()) this.close();
    else this.show();
  }

  show(): void {
    if (this.isDisabled()) return;
    const rect = this.host.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    this.up.set(below < Math.min(PANEL_MAX, this.options().length * 44 + 16) && rect.top > below);
    this.active.set(Math.max(0, this.selectedIndex()));
    this.open.set(true);
    queueMicrotask(() => this.scrollActive());
  }

  close(focusButton = false): void {
    if (!this.open()) return;
    this.open.set(false);
    this.onTouched();
    if (focusButton) this.host.querySelector<HTMLElement>('button[role=combobox]')?.focus();
  }

  pick(index: number): void {
    const option = this.options()[index];
    if (!option || option.disabled) return;
    if (option.value !== this.value()) {
      this.value.set(option.value);
      this.onChange(option.value);
      this.changed.emit(option.value);
    }
    this.close(true);
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.isDisabled()) return;
    const count = this.options().length;
    const move = (to: number) => {
      event.preventDefault();
      if (!this.open()) {
        this.show();
        return;
      }
      this.active.set(Math.min(count - 1, Math.max(0, to)));
      this.scrollActive();
    };
    switch (event.key) {
      case 'ArrowDown':
        return move(this.active() + 1);
      case 'ArrowUp':
        return move(this.active() - 1);
      case 'Home':
        if (this.open()) move(0);
        return;
      case 'End':
        if (this.open()) move(count - 1);
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (this.open()) this.pick(this.active());
        else this.show();
        return;
      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          event.stopPropagation();
          this.close(true);
        }
        return;
      case 'Tab':
        this.close();
        return;
    }
  }

  private scrollActive(): void {
    this.list()?.nativeElement.querySelector<HTMLElement>(`[data-index="${this.active()}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  writeValue(value: unknown): void {
    this.value.set(value == null ? '' : String(value));
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.formDisabled.set(disabled);
  }
}
