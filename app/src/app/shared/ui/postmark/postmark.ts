import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * 티켓 반권에 찍힌 소인. 실제 도장이 아니라 장식이므로 옅게 두고 살짝 기울인다.
 * 티켓을 쓰는 화면끼리 같은 모양을 공유한다.
 */
@Component({
  selector: 'app-postmark',
  templateUrl: './postmark.html',
  host: { class: 'inline-block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiPostmark {
  readonly size = input(84);
}
