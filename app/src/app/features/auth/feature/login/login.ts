import { UiSpinner } from '../../../../shared/ui/spinner/spinner';
import { UiButton } from '../../../../shared/ui/button/button';
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
  readonly previewAccount = this.auth.designPreview && inject(Router).url.startsWith('/account');
  readonly displayedUser = computed(
    () =>
      this.auth.user() ??
      (this.previewAccount
        ? { email: '디자인 미리보기', app_metadata: { provider: 'google' } }
        : null),
  );
  /**
   * 로그인을 마치고 다른 화면으로 넘어가는 중임을 나타낸다.
   *
   * 세션이 복원되면 user가 채워지는데, 이동이 끝나기 전까지 이 화면이 남아
   * '내 정보'가 한 순간 스쳐 보였다. 떠나기로 정한 시점부터 본문을 감춘다.
   */
  readonly leaving = signal(false);

  /** Suppresses the account and provider surfaces while a redirect is still being consumed. */
  readonly settling = computed(
    () => this.auth.loading() || this.auth.resolvingCallback() || this.leaving(),
  );
  /**
   * 내 정보 본문을 실제로 보여주는 상황인지 나타낸다.
   *
   * 정렬은 지금 화면에 무엇이 보이는지를 따라가야 한다. 확인 중에는
   * displayedUser()가 참이어도 스피너만 보이므로, 로그인과 같은 가운데
   * 정렬을 유지해야 스피너가 왼쪽 위로 떨어지지 않는다.
   */
  readonly accountView = computed(() => !this.settling() && !!this.displayedUser());
  readonly confirmation = signal('');

  reload(): void {
    location.reload();
  }

  enterPreview(): void {
    sessionStorage.setItem('tc.preview.v1', '1');
    void this.router.navigateByUrl('/trips');
  }

  constructor() {
    const bar = inject(PageBar);
    const router = this.router;
    effect(() => {
      const user = this.auth.user();
      const resolving = this.auth.resolvingCallback();
      const loading = this.auth.loading();
      const previewing = this.auth.designPreview && !router.url.startsWith('/auth/callback');
      // A provider redirect may land on any path, so it must leave even from /account.
      const staying = router.url.startsWith('/account') && !resolving;

      /*
        이 화면을 떠날지 먼저 정한다. 상단 바 제목을 그다음에 정해야
        목록으로 가는 길에 '내 정보'가 한 순간 스쳐 보이지 않는다.
      */
      const goesToTrips = !previewing && !loading && !!user && !staying;
      const goesToLogin = !previewing && !loading && !user && router.url.startsWith('/account');
      // 로그인으로 되돌아가는 길은 감추지 않는다. 도착한 화면이 로그인이라 그대로 맞다.
      if (goesToTrips) this.leaving.set(true);

      const account = ((user && !resolving) || this.previewAccount) && !goesToTrips;
      bar.set({
        title: account ? '내 정보' : '로그인',
        back: account ? ['/trips'] : null,
        action: null,
        // 로그인은 첫 화면이라 상단 바가 필요 없다. 내 정보는 본문이라 남긴다.
        hidden: !account,
      });
      this.confirmation.set('');
      if (previewing) return;
      if (loading) return;
      if (goesToTrips)
        void router
          .navigateByUrl(this.auth.nickname() ? '/trips' : '/onboarding', { replaceUrl: true })
          .finally(() => this.auth.settleCallback());
      else if (goesToLogin)
        void router
          .navigateByUrl('/login', { replaceUrl: true })
          .finally(() => this.auth.settleCallback());
      else this.auth.settleCallback();
    });
    void this.auth.initialize();
  }
}
