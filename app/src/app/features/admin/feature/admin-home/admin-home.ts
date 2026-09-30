import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageBar } from '../../../../core/page-bar';
import { IconComponent } from '../../../../shared/ui/icon/icon';

/** 관리자 진입 화면. 공지 관리와 문의 관리로 간다(2026-10-01). */
@Component({
  selector: 'app-admin-home',
  imports: [IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-home.html',
})
export class AdminHome {
  constructor() {
    inject(PageBar).set({ title: '관리자', back: ['/account'], action: null });
  }
}
