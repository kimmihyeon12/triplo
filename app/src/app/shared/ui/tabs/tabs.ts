import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output } from '@angular/core';
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
