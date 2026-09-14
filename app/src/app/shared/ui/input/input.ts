import { INPUT_CLASSES } from './input.styles';
import { Directive, ElementRef, inject } from '@angular/core';

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
}
