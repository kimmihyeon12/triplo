import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PageBar } from '../../../../core/page-bar';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiField } from '../../../../shared/ui/field/field';
import { UiInput } from '../../../../shared/ui/input/input';
import { formatCode, inviteCodeFrom } from '../../data/invite-code';

/**
 * 초대 링크로 참여(2026-10-01). 아이폰은 홈 화면 앱으로 링크를 넘기지 않아 초대 링크가 Safari로 열린다.
 * 링크를 복사해 앱에서 붙여 넣으면 앱 안의 합류 화면(/join/:code)으로 간다.
 */
@Component({
  selector: 'app-join-paste',
  imports: [FormsModule, UiButton, UiField, UiInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './join-paste.html',
})
export class JoinPaste {
  private readonly router = inject(Router);
  readonly text = signal('');
  readonly error = signal<string | null>(null);
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('linkInput');

  constructor() {
    inject(PageBar).set({ title: '초대 링크로 참여', back: ['/trips'], action: null });
  }

  /** 누를 때만 클립보드를 읽는다. 읽지 못하면 직접 붙여 넣으면 된다. */
  async paste(): Promise<void> {
    try {
      const value = (await navigator.clipboard?.readText())?.trim();
      if (value) {
        this.text.set(value);
        this.error.set(null);
        return;
      }
    } catch {
      // 권한 거부·지원하지 않는 브라우저
    }
    this.input()?.nativeElement.focus();
  }

  open(event?: Event): void {
    event?.preventDefault();
    const code = inviteCodeFrom(this.text());
    if (!code) {
      this.error.set('초대 링크나 코드(예: ABCD-EFGH)를 붙여 넣어 주세요.');
      return;
    }
    void this.router.navigate(['/join', formatCode(code)]);
  }
}
