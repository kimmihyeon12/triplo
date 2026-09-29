import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

export interface TabItem {
  readonly id: string;
  readonly label: string;
  /** 지정하면 쿼리 파라미터를 바꾸는 링크로, 없으면 버튼으로 그린다. */
  readonly queryParams?: Record<string, unknown>;
  readonly testId?: string;
}

/**
 * 밑줄 탭. 화면마다 같은 클래스를 복사하지 않도록 한곳에서 모양을 정한다.
 * 링크형(쿼리 파라미터)과 버튼형(로컬 상태)을 모두 받는다.
 */
@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.html',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tabs-bar flex items-center [border-bottom:1px_solid_var(--color-border)] -mt-0.5' },
})
export class UiTabs {
  readonly items = input.required<readonly TabItem[]>();
  readonly active = input.required<string>();
  readonly ariaLabel = input('보기 전환');
  readonly selected = output<string>();
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly ink = viewChild.required<ElementRef<HTMLElement>>('ink');

  constructor() {
    // 탭이 바뀌거나 탭 줄 폭이 바뀌면(글꼴 로드·회전) 밑줄을 다시 맞춘다.
    afterRenderEffect(() => {
      this.active();
      this.items();
      this.placeInk();
    });
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => this.placeInk());
      observer.observe(this.host.nativeElement as HTMLElement);
      inject(DestroyRef).onDestroy(() => observer.disconnect());
    }
  }

  /**
   * 선택된 탭 아래로 밑줄을 옮긴다. 처음 자리를 잡을 때는 움직이지 않고,
   * 그다음부터 미끄러진다. 화면이 열리자마자 밑줄이 날아오면 산만하다.
   */
  private placeInk(): void {
    const ink = this.ink().nativeElement;
    const on = (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('.tab--on');
    if (!on) {
      ink.style.opacity = '0';
      return;
    }
    ink.style.width = `${on.offsetWidth}px`;
    ink.style.transform = `translateX(${on.offsetLeft}px)`;
    ink.style.opacity = '1';
    if (!ink.dataset['live']) {
      ink.dataset['live'] = '1';
      requestAnimationFrame(() => {
        ink.style.transition =
          'transform 260ms var(--ease-out), width 260ms var(--ease-out)';
      });
    }
  }

  /**
   * 방향키로 옆 탭에 간다. role=tab을 쓰면 화살표 이동을 기대하기 때문이다.
   * 탭을 자기 안에서만 찾는다. 문서 전체에서 찾으면 한 화면에 탭이 둘 이상일 때
   * 다른 탭 줄의 같은 id를 집는다.
   */
  onKeydown(event: KeyboardEvent, index: number): void {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const items = this.items();
    const next = event.key === 'ArrowRight' ? index + 1 : index - 1;
    if (next < 0 || next >= items.length) return;
    const targetId = items[next]?.id;
    if (!targetId) return;
    const target = (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>(
      `[data-tab-id="${CSS.escape(targetId)}"]`,
    );
    if (!target) return;
    event.preventDefault();
    target.focus();
    target.click();
  }
}
