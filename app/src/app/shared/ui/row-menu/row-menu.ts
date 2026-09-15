import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { IconComponent } from '../icon/icon';
import { UiDismissible } from '../dismissible/dismissible';

export interface RowMenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  /** 파괴적 동작이면 true. 목록 끝에 두고 로즈 계열로 그린다. */
  readonly danger?: boolean;
  readonly testId?: string;
}

/**
 * 목록 행의 수정·삭제 같은 동작을 담는 더보기 메뉴.
 * 행마다 버튼을 늘어놓으면 목록이 시끄러워지고 화면마다 형태가 갈린다.
 */
@Component({
  selector: 'app-row-menu',
  templateUrl: './row-menu.html',
  imports: [IconComponent, UiDismissible],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'row-menu inline-flex' },
})
export class UiRowMenu {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly items = input.required<readonly RowMenuItem[]>();
  readonly ariaLabel = input('더보기');
  readonly testId = input('');
  readonly selected = output<string>();
  readonly position = signal({ top: 0, left: 0 });

  /**
   * 화면 기준 좌표를 직접 잡는다. 아래에 자리가 없으면 위로 열고,
   * 오른쪽으로 넘치면 왼쪽으로 당긴다.
   * 폭·높이는 그려진 패널에서 직접 재야 테두리·안쪽 여백까지 맞는다.
   */
  onToggle(open: boolean): void {
    if (!open) return;
    const rect = this.host.nativeElement.getBoundingClientRect();
    const panel = this.host.nativeElement.querySelector<HTMLElement>('[role="menu"]');
    const width = panel?.offsetWidth || 186;
    const height = panel?.offsetHeight || this.items().length * 44 + 8;
    // 화면 폭은 스크롤바를 뺀 값이라야 오른쪽 끝이 잘리지 않는다.
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const below = vh - rect.bottom;
    const top = below < height + 8 ? rect.top - height - 4 : rect.bottom + 4;
    const left = Math.min(Math.max(8, rect.right - width), vw - width - 8);
    this.position.set({ top: Math.max(8, top), left: Math.max(8, left) });
  }
}
