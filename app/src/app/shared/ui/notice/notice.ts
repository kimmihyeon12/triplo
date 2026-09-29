import { NOTICE_CLASSES } from './notice.styles';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'div[appNotice]',
  templateUrl: './notice.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'classes',
    '[class.notice--warn]': "tone() === 'warn'",
    '[class.notice--danger]': "tone() === 'danger'",
    '[class.notice--ok]': "tone() === 'ok'",
    '[class.notice--muted]': "tone() === 'muted'",
  },
})
export class UiNotice {
  readonly classes = NOTICE_CLASSES;
  /**
   * `muted`는 주의가 아니라 설명을 담는 자리다. 왜 값이 비었는지, 무엇이
   * 집계에서 빠졌는지처럼 알려는 주되 고칠 것이 없는 내용에 쓴다. 이런
   * 문구에 warn(노랑)을 쓰면 사용자가 잘못한 것처럼 읽히고, 그렇다고 그릇
   * 없이 두면 화면마다 회색 상자를 따로 만들게 된다(2026-09-23 통일).
   */
  readonly tone = input<'warn' | 'danger' | 'ok' | 'muted' | null>(null);
}
