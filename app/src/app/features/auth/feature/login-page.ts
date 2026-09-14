import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { IconComponent } from '../../../shared/ui/icon';
import { PageBar } from '../../../core/page-bar';

/**
 * SNS 로그인 화면.
 *
 * 아직 Supabase Auth를 연결하지 않았으므로 버튼을 눌러도 실제 로그인은 되지 않는다.
 * 준비 중임을 화면에 분명히 밝힌다.
 *
 * 버튼은 카카오·구글이 배포하는 공식 이미지를 그대로 쓴다. 두 회사 모두
 * 브랜드 가이드에서 로고 변형·심볼 단독 사용을 금지하고 버튼 문구도
 * 정해진 범위로 제한하므로 자체 버튼을 만들지 않는다.
 */
type Provider = 'kakao' | 'google';

@Component({
  selector: 'app-login-page',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  private readonly pageBar = inject(PageBar);

  readonly providerLabel: Record<Provider, string> = {
    kakao: '카카오',
    google: '구글',
  };

  /** 마지막으로 누른 제공자. 미연결 안내를 그 이름으로 보여준다. */
  readonly tried = signal<Provider | null>(null);

  constructor() {
    this.pageBar.set({ title: '로그인', back: ['/trips'], action: null });
  }

  notReady(provider: Provider): void {
    this.tried.set(provider);
  }
}
