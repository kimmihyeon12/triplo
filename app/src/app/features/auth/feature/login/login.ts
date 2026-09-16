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

@Component({
  selector: 'app-login',
  imports: [UiButton, UiInput, UiSpinner, ErrorToast, RouterLink, IconComponent],
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
  /** Suppresses the account and provider surfaces while a redirect is still being consumed. */
  readonly settling = computed(() => this.auth.loading() || this.auth.resolvingCallback());
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
      const account = (user && !resolving) || this.previewAccount;
      bar.set({
        title: account ? '내 정보' : '로그인',
        back: account ? ['/trips'] : null,
        action: null,
        // 로그인은 첫 화면이라 상단 바가 필요 없다. 내 정보는 본문이라 남긴다.
        hidden: !account,
      });
      this.confirmation.set('');
      if (this.auth.designPreview && !router.url.startsWith('/auth/callback')) return;
      if (this.auth.loading()) return;
      // A provider redirect may land on any path, so it must leave even from /account.
      const staying = router.url.startsWith('/account') && !resolving;
      if (user && !staying)
        void router
          .navigateByUrl(this.auth.nickname() ? '/trips' : '/onboarding', { replaceUrl: true })
          .finally(() => this.auth.settleCallback());
      else if (!user && router.url.startsWith('/account'))
        void router
          .navigateByUrl('/login', { replaceUrl: true })
          .finally(() => this.auth.settleCallback());
      else this.auth.settleCallback();
    });
    void this.auth.initialize();
  }
}
