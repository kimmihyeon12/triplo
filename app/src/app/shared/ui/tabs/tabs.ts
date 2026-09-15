import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
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
}
