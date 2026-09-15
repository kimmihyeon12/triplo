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
