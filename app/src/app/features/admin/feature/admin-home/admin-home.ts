import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PageBar } from '../../../../core/page-bar';
import { IconComponent } from '../../../../shared/ui/icon/icon';

/**
 * 관리자 진입 화면.
 *
 * 공지·문의 관리는 서버 표가 생긴 뒤에 붙인다(OpenSpec 14.8·14.9). 지금은
 * 어떤 일이 이 자리에 올지 보여주고 누를 수 없게 둔다. 링크처럼 보이면
 * 눌러 보고 아무 일도 없어 헷갈린다.
 */
@Component({
  selector: 'app-admin-home',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-home.html',
})
export class AdminHome {
  constructor() {
    inject(PageBar).set({ title: '관리자', back: ['/account'], action: null });
  }
}
