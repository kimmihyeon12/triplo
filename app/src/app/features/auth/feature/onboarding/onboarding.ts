import { UiField } from '../../../../shared/ui/field/field';
import { UiInput } from '../../../../shared/ui/input/input';
import { UiButton } from '../../../../shared/ui/button/button';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PageBar } from '../../../../core/page-bar';
import { UiToast } from '../../../../shared/ui/toast/toast';
import { AuthStore } from '../../data/auth-store';
import { takeReturn } from '../../util/return-to';

@Component({
  selector: 'app-onboarding',
  imports: [UiButton, UiField, UiInput, UiToast],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './onboarding.html',
})
export class OnboardingPage {
  readonly auth = inject(AuthStore);
  readonly nickname = signal('');
  private readonly router = inject(Router);

  /** 이 화면에서 닉네임을 막 저장했는지. 처음 가입한 사람만 사용법으로 보낸다. */
  private justSaved = false;

  constructor() {
    inject(PageBar).set({ title: '닉네임 설정', back: null, action: null });
    effect(() => {
      if (this.auth.designPreview) return;
      if (this.auth.loading()) return;
      if (!this.auth.user()) void this.router.navigateByUrl('/login', { replaceUrl: true });
      else if (this.auth.nickname() && !this.auth.busy())
        // 초대 링크로 왔다면 닉네임을 정한 뒤 합류 화면으로 돌아간다. 처음 가입해 닉네임을 막
        // 정한 사람은 구름이가 안내하는 사용법을 먼저 본다(2026-10-01 사용자 요청).
        void this.router.navigateByUrl(
          takeReturn() ?? (this.justSaved && !this.auth.guideSeen() ? '/account/guide?first=1' : '/trips'),
          { replaceUrl: true },
        );
    });
    void this.auth.initialize();
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.auth.designPreview && !this.auth.user()) {
      // 아래 저장 경로와 같이 치운다. 닉네임을 정하고 나면 이 화면으로
      // 되돌아올 일이 없다.
      void this.router.navigateByUrl('/trips', { replaceUrl: true });
      return;
    }
    this.justSaved = true;
    const saved = await this.auth.saveNickname(this.nickname());
    if (!saved) this.justSaved = false;
    if (saved && this.auth.designPreview) {
      await this.router.navigateByUrl('/trips', { replaceUrl: true });
    }
  }
}
