import { UiButton } from '../button/button';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon';

/** 저장 실패(재시도)와 충돌(새로 불러오기)만 보여 준다. 저장 중·저장됨은 그리지 않는다. */
@Component({
  host: { class: 'inline-flex items-center' },
  selector: 'app-save-status',
  imports: [UiButton, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './save-status.html',
})
export class SaveStatusComponent {
  readonly state = input<'idle' | 'saving' | 'saved' | 'error' | 'conflict'>('idle');
  readonly retry = output<void>();
  /** 충돌 뒤 서버 최신본을 다시 읽는다. */
  readonly reload = output<void>();
}
