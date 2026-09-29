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

  constructor() {
    inject(PageBar).set({ title: '닉네임 설정', back: null, action: null });
    effect(() => {
      if (this.auth.designPreview) return;
      if (this.auth.loading()) return;
      if (!this.auth.user()) void this.router.navigateByUrl('/login', { replaceUrl: true });
      else if (this.auth.nickname() && !this.auth.busy())
        // 초대 링크로 왔다면 닉네임을 정한 뒤 합류 화면으로 돌아간다.
        void this.router.navigateByUrl(takeReturn() ?? '/trips', { replaceUrl: true });
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
    const saved = await this.auth.saveNickname(this.nickname());
    if (saved && this.auth.designPreview) {
      await this.router.navigateByUrl('/trips', { replaceUrl: true });
    }
  }
}
