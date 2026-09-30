import { SAVES_TO_SERVER } from '../../../../core/storage-mode';
import { UiSpinner } from '../../../../shared/ui/spinner/spinner';
import { UiButton } from '../../../../shared/ui/button/button';
import { APP_VERSION } from '../../../../core/version';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { UiToast } from '../../../../shared/ui/toast/toast';
import { PageBar } from '../../../../core/page-bar';
import { AuthStore } from '../../data/auth-store';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { UiBarcode } from '../../../../shared/ui/barcode/barcode';
import { UiPostmark } from '../../../../shared/ui/postmark/postmark';
import { UiTicketTilt } from '../../../../shared/ui/ticket-tilt/ticket-tilt';
import { takeReturn } from '../../util/return-to';

@Component({
  selector: 'app-login',
  imports: [
    UiButton,
    UiSpinner,
    UiToast,
    IconComponent,
    UiBarcode,
    UiPostmark,
    UiTicketTilt,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
})
export class LoginPage {
  /** 저장 위치 안내를 운영(서버)과 테스트·미리보기(기기)로 나눈다. */
  readonly savesToServer = SAVES_TO_SERVER;
  readonly auth = inject(AuthStore);
  readonly router = inject(Router);

  /**
   * 로그인을 마치고 다른 화면으로 넘어가는 중임을 나타낸다.
   *
   * 세션이 복원되면 user가 채워지는데, 이동이 끝나기 전까지 이 화면이 남아
   * 로그인 버튼이 한 순간 스쳐 보였다. 떠나기로 정한 시점부터 본문을 감춘다.
   */
  readonly leaving = signal(false);

  /** Suppresses the provider surface while a redirect is still being consumed. */
  readonly settling = computed(
    () => this.auth.loading() || this.auth.resolvingCallback() || this.leaving(),
  );

  reload(): void {
    location.reload();
  }

  enterPreview(): void {
    sessionStorage.setItem('tc.preview.v1', '1');
    // 실제 로그인과 같이 치운다. 그대로 두면 목록에서 뒤로 갔을 때 이미
    // 지나온 로그인 화면이 다시 나타난다.
    void this.router.navigateByUrl('/trips', { replaceUrl: true });
  }

  constructor() {
    // 로그인은 첫 화면이라 상단 바가 필요 없다. /auth/callback도 같다.
    inject(PageBar).set({ title: '로그인', back: null, action: null, hidden: true });
    const router = this.router;
    effect(() => {
      const user = this.auth.user();
      const loading = this.auth.loading();
      const previewing = this.auth.designPreview && !router.url.startsWith('/auth/callback');

      // 로그인한 사람이 이 화면에 있을 이유가 없다. 닉네임 유무로 갈라 보낸다.
      const leaves = !previewing && !loading && !!user;
      if (leaves) this.leaving.set(true);

      if (previewing) return;
      if (loading) return;
      if (leaves)
        void router
          // 초대 링크로 왔다면 로그인 뒤 합류 화면으로 돌아간다. 닉네임이 없으면 설정 뒤에 돌아간다.
          .navigateByUrl(this.auth.nickname() ? (takeReturn() ?? '/trips') : '/onboarding', {
            replaceUrl: true,
          })
          .finally(() => this.auth.settleCallback());
      else this.auth.settleCallback();
    });
    void this.auth.initialize();
  }
}
