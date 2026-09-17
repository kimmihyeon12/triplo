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
import { UiInput } from '../../../../shared/ui/input/input';
import { Router, RouterLink } from '@angular/router';
import { ErrorToast } from '../../../../shared/ui/error-toast/error-toast';
import { PageBar } from '../../../../core/page-bar';
import { AuthStore } from '../../data/auth-store';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { UiBarcode } from '../../../../shared/ui/barcode/barcode';
import { UiPostmark } from '../../../../shared/ui/postmark/postmark';
import { UiTicketTilt } from '../../../../shared/ui/ticket-tilt/ticket-tilt';

@Component({
  selector: 'app-login',
  imports: [
    UiButton,
    UiInput,
    UiSpinner,
    ErrorToast,
    RouterLink,
    IconComponent,
    UiBarcode,
    UiPostmark,
    UiTicketTilt,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
})
export class LoginPage {
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
    void this.router.navigateByUrl('/trips');
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
          .navigateByUrl(this.auth.nickname() ? '/trips' : '/onboarding', { replaceUrl: true })
          .finally(() => this.auth.settleCallback());
      else this.auth.settleCallback();
    });
    void this.auth.initialize();
  }
}
