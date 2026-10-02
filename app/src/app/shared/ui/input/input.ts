import { INPUT_CLASSES } from './input.styles';
import {
  ComponentRef,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  ViewContainerRef,
} from '@angular/core';
import type { TemporalPicker } from '../temporal-picker/temporal-picker';

/** Styles native inputs without replacing their label, validity or Angular forms behavior. */
@Directive({
  selector: 'input[appInput], select[appInput], textarea[appInput]',
  host: {
    '[class]': 'classes',
    '[class.input]': "tag === 'INPUT'",
    '[class.select]': "tag === 'SELECT'",
    '[class.textarea]': "tag === 'TEXTAREA'",
  },
})
export class UiInput {
  readonly classes = INPUT_CLASSES;
  readonly tag = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.tagName;

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const view = inject(ViewContainerRef);
    const destroy = inject(DestroyRef);
    if (element instanceof HTMLSelectElement) {
      /*
       * 열린 선택 목록을 터치로 다시 누르면 닫혀야 한다. Chrome의 사용자 지정
       * select(base-select)는 누르는 순간 목록을 바깥 누름으로 닫고, 터치 뒤에
       * 따라오는 호환용 mousedown으로 다시 연다. 열려 있을 때 터치 누름을
       * 취소해 그 mousedown을 막는다. 마우스는 이미 제대로 닫히므로 건드리지 않는다.
       */
      const onPointerDown = (event: PointerEvent) => {
        // 목록의 항목(option)을 누른 것은 막지 않는다. 그것까지 취소해 터치·휴대폰 보기에서
        // 항목이 회색으로만 바뀌고 골라지지 않았다(2026-10-02). 상자 자체를 다시 누를 때만 막는다.
        if (event.target !== element) return;
        if (event.pointerType !== 'mouse' && isOpen(element)) event.preventDefault();
      };
      element.addEventListener('pointerdown', onPointerDown);
      destroy.onDestroy(() => element.removeEventListener('pointerdown', onPointerDown));
      return;
    }
    if (!(element instanceof HTMLInputElement) || !['date', 'time'].includes(element.type)) return;
    const appleTouch =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (appleTouch) {
      const nativeType = element.type;
      element.dataset['nativeType'] = nativeType;
      element.type = 'text';
      element.dataset['customPicker'] = 'true';
      element.readOnly = true;
      if (!element.classList.contains('range-date')) {
        element.style.backgroundImage = `url('/icons/${nativeType === 'time' ? 'clock' : 'calendar'}.svg')`;
        element.style.backgroundRepeat = 'no-repeat';
        element.style.backgroundSize = '18px 18px';
        element.style.backgroundPosition = 'right 12px center';
        element.style.paddingRight = '40px';
      }
    }
    let picker: ComponentRef<TemporalPicker> | undefined;
    let opening = false;
    element.setAttribute('aria-haspopup', 'dialog');
    const open = async (event: Event) => {
      if (element.disabled || (element.readOnly && !element.dataset['customPicker'])) return;
      event.preventDefault();
      if (opening) return;
      opening = true;
      try {
        if (!picker) {
          const { TemporalPicker } = await import('../temporal-picker/temporal-picker');
          if (destroy.destroyed) return;
          picker = view.createComponent(TemporalPicker);
          picker.setInput('target', element);
          picker.changeDetectorRef.detectChanges();
        }
        const start = element.ownerDocument.getElementById(element.dataset['rangeStart'] ?? '');
        const end = element.ownerDocument.getElementById(element.dataset['rangeEnd'] ?? '');
        picker.setInput('rangeStart', start instanceof HTMLInputElement ? start : null);
        picker.setInput('rangeEnd', end instanceof HTMLInputElement ? end : null);
        picker.instance.open();
      } finally {
        opening = false;
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || (event.altKey && event.key === 'ArrowDown')) void open(event);
    };
    element.addEventListener('click', open);
    element.addEventListener('keydown', key);
    destroy.onDestroy(() => {
      element.removeEventListener('click', open);
      element.removeEventListener('keydown', key);
    });
  }
}

/** ':open'을 모르는 브라우저에서는 닫힌 것으로 본다(그 브라우저는 기본 선택 창을 쓴다). */
function isOpen(select: HTMLSelectElement): boolean {
  try {
    return select.matches(':open');
  } catch {
    return false;
  }
}
