import { afterNextRender, Directive, ElementRef, inject } from '@angular/core';

/**
 * 행 안에 펼쳐지는 확인 칸을 나타날 때 화면 안으로 올린다.
 *
 * 화면 아래쪽 행에서 삭제 확인을 열면 떠 있는 AI 챗봇 버튼과 일정 추가 바가 그 칸을
 * 덮었다(2026-10-07 사용자 제보). 아래 여백(scroll-mb-44, 176px)은 일정 추가 바와
 * 그 위 챗봇 버튼·펭귄 그림을 합친 높이보다 크게 잡는다.
 */
@Directive({ selector: '[appReveal]', host: { class: 'scroll-mb-44' } })
export class UiReveal {
  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      const reduce = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      host.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    });
  }
}
