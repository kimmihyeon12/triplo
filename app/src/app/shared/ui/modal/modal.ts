import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, inject, OnDestroy, OnInit, output } from '@angular/core';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * 화면 위에 뜨는 모달(aria-modal)의 키보드 동작을 맡는다. 모달이 열린 동안만 요소가
 * 있도록 @if 안에 두면, 만들어질 때 열고 사라질 때 닫는다.
 *
 * - 열 때 포커스를 모달로 옮기고, 모달 바깥은 inert로 막아 키보드·화면 읽기가 닿지 않게 한다.
 * - Tab은 모달 안에서만 돌고, Escape는 dismiss를 알린다.
 * - 닫으면 연 버튼으로 포커스를 돌려준다.
 *
 * aria-modal만 선언하고 이것이 없으면 Shift+Tab으로 뒤 화면의 버튼이 잡히고 Escape로
 * 닫히지 않았다(2026-09-30 감리 P1-06). 모달이 화면 안쪽(라우트 컴포넌트)에 있어
 * main 전체를 막으면 모달도 막히므로, 모달에서 body까지 올라가며 형제만 막는다.
 */
@Directive({
  selector: '[appModal]',
  host: { tabindex: '-1', '(keydown)': 'onKeydown($event)' },
})
export class UiModal implements OnInit, OnDestroy {
  readonly dismiss = output<void>();

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private opener: HTMLElement | null = null;
  private readonly blocked: HTMLElement[] = [];

  ngOnInit(): void {
    const active = this.document.activeElement;
    this.opener = active instanceof HTMLElement && active !== this.document.body ? active : null;
    for (let node: HTMLElement | null = this.element; node && node !== this.document.body; node = node.parentElement) {
      for (const sibling of Array.from(node.parentElement?.children ?? [])) {
        if (sibling === node || !(sibling instanceof HTMLElement) || sibling.inert) continue;
        // 모달의 배경 막(aria-hidden)은 눌러서 닫아야 하고, 알림 토스트는 모달 위에서도
        // 닫기·다시 저장을 누를 수 있어야 하므로 막지 않는다.
        if (sibling.getAttribute('aria-hidden') === 'true' || sibling.tagName === 'APP-TOAST') continue;
        sibling.inert = true;
        this.blocked.push(sibling);
      }
    }
    // 입력창에 바로 두면 휴대폰에서 키보드가 올라와 화면을 가린다. 모달 자체에 둔다.
    queueMicrotask(() => this.element.focus({ preventScroll: true }));
  }

  ngOnDestroy(): void {
    for (const sibling of this.blocked) sibling.inert = false;
    this.blocked.length = 0;
    if (this.opener?.isConnected) this.opener.focus({ preventScroll: true });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.dismiss.emit();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = Array.from(this.element.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === this.document.activeElement,
    );
    if (!items.length) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const current = this.document.activeElement;
    if (event.shiftKey && (current === first || current === this.element)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
