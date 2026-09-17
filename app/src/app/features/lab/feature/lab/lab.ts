import { environment } from '../../../../../environments/environment';
import { RouterLink } from '@angular/router';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  inject,
  signal,
} from '@angular/core';
import { PageBar } from '../../../../core/page-bar';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiInput } from '../../../../shared/ui/input/input';
import { UiField } from '../../../../shared/ui/field/field';
import { UiBadge } from '../../../../shared/ui/badge/badge';
import { UiNotice } from '../../../../shared/ui/notice/notice';
import { UiSwitch } from '../../../../shared/ui/switch/switch';
import { UiSpinner } from '../../../../shared/ui/spinner/spinner';
import { UiActionBar } from '../../../../shared/ui/action-bar/action-bar';
import { ErrorToast } from '../../../../shared/ui/error-toast/error-toast';
import { IconComponent } from '../../../../shared/ui/icon/icon';

@Component({
  selector: 'app-lab',
  imports: [
    RouterLink,
    UiButton,
    UiInput,
    UiField,
    UiBadge,
    UiNotice,
    UiSpinner,
    UiSwitch,
    UiActionBar,
    ErrorToast,
    IconComponent,
  ],
  templateUrl: './lab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabPage {
  readonly designPreview = environment.designPreview;
  private readonly document = inject(DOCUMENT);
  readonly busy = signal(false);
  readonly toast = signal(false);
  readonly inputError = signal(false);
  readonly labSwitch = signal(true);
  readonly nickname = signal('');
  readonly linkClicks = signal(0);
  readonly colors = [
    ['accent-deep', '주요 동작'],
    ['accent-tint', '선택·포커스'],
    ['ground', '화면 배경'],
    ['panel', '콘텐츠 배경'],
    ['ink', '본문'],
    ['ink-2', '보조 본문'],
    ['ink-3', '설명'],
    ['border', '구분선'],
    ['stay-ink', '숙소'],
    ['stay-tint', '숙소 배경'],
    ['warn-ink', '확인 필요'],
    ['warn-tint', '확인 배경'],
    ['danger-ink', '오류'],
    ['danger-tint', '오류 배경'],
    ['ok-ink', '완료'],
    ['ok-tint', '완료 배경'],
  ].map(([name, label]) => ({
    name,
    label,
    value: getComputedStyle(this.document.documentElement)
      .getPropertyValue('--color-' + name)
      .trim(),
  }));
  readonly spaces = [4, 8, 12, 16, 24, 32];
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(PageBar).set({ title: '실험실', back: ['/trips'], action: null });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  simulateLoading(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.timer = setTimeout(() => this.busy.set(false), 1200);
  }

  scrollTo(event: Event, id: string): void {
    event.preventDefault();
    this.document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }
}
