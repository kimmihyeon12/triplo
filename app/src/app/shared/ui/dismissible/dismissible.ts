import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';

/**
 * `details` 팝오버를 바깥 클릭·Escape로 닫는다.
 *
 * `pointerdown`이 아니라 `click`을 듣는다. 터치에서는 손가락을 떼기 전에 닫으면
 * 안쪽 링크가 사라져 탭이 라우팅으로 이어지지 않는다. 버블 단계에서 듣는 것도
 * 같은 이유로, 링크가 제 일을 마친 뒤에 닫히게 한다.
 */
@Directive({ selector: 'details[appDismissible]' })
export class UiDismissible {
  constructor() {
    const host = inject<ElementRef<HTMLDetailsElement>>(ElementRef).nativeElement;
    const close = (event: Event) => {
      if (!host.open) return;
      if (event.target instanceof Node && host.contains(event.target)) return;
      host.open = false;
    };
    const syncBackdrop = () => document.body.classList.toggle('modal-open', host.open);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !host.open) return;
      host.open = false;
      // Return focus so keyboard users do not lose their place.
      host.querySelector('summary')?.focus();
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    host.addEventListener('toggle', syncBackdrop);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
      host.removeEventListener('toggle', syncBackdrop);
      document.body.classList.remove('modal-open');
    });
  }
}
