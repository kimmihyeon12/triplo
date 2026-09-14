import { UiField } from '../../../../shared/ui/field/field';
import { UiInput } from '../../../../shared/ui/input/input';
import { UiButton } from '../../../../shared/ui/button/button';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PageBar } from '../../../../core/page-bar';
import { ErrorToast } from '../../../../shared/ui/error-toast/error-toast';
import { AuthStore } from '../../data/auth-store';

@Component({
  selector: 'app-onboarding',
  imports: [UiButton, UiField, UiInput, ErrorToast],
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
        void this.router.navigateByUrl('/trips', { replaceUrl: true });
    });
    void this.auth.initialize();
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.auth.designPreview && !this.auth.user()) {
      void this.router.navigateByUrl('/trips');
      return;
    }
    const saved = await this.auth.saveNickname(this.nickname());
    if (saved && this.auth.designPreview) {
      await this.router.navigateByUrl('/trips', { replaceUrl: true });
    }
  }
}
