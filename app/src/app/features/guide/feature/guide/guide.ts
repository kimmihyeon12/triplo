import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../../auth/data/auth-store';
import { PageBar } from '../../../../core/page-bar';
import { UiActionBar } from '../../../../shared/ui/action-bar/action-bar';
import { UiButton } from '../../../../shared/ui/button/button';
import { GUIDE_SLIDES, guideImage } from '../../model/guide';
import { GUIDE_MARKS } from '../../model/guide-marks';

/**
 * 구름이가 안내하는 앱 사용법. 처음 가입한 사람은 닉네임을 정한 직후에 보고(?first=1),
 * 내 정보의 '사용법 보기'로 언제든 다시 본다. 끝까지 보거나 건너뛰면 본 것으로 남긴다.
 */
@Component({
  selector: 'app-guide',
  imports: [UiActionBar, UiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './guide.html',
  host: { '(keydown)': 'onKey($event)' },
})
export class GuidePage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  /** 라우트의 ?first=1. 처음 가입한 흐름이면 끝난 뒤 여행 목록으로 간다. */
  readonly first = input<string | undefined>();
  readonly slides = GUIDE_SLIDES;
  readonly index = signal(0);
  readonly slide = computed(() => this.slides[this.index()]!);
  readonly image = computed(() => guideImage(this.slide()));
  /** 캡처 위 설명 번호. 캡처를 찍을 때 화면 요소의 자리를 재서 만든다(guide-marks.ts). */
  readonly marks = computed(() => GUIDE_MARKS[this.slide().key] ?? []);
  /** 고른 설명 번호. 그 자리만 밝게 보인다. 없으면 모든 표시를 옅게 보인다. */
  readonly focus = signal<number | null>(null);
  readonly last = computed(() => this.index() === this.slides.length - 1);
  private startX: number | null = null;

  constructor() {
    inject(PageBar).set({ title: '사용법', back: ['/account'], action: null });
  }

  go(i: number): void {
    this.index.set(Math.max(0, Math.min(this.slides.length - 1, i)));
    this.focus.set(null);
  }

  pick(n: number): void {
    this.focus.set(this.focus() === n ? null : n);
  }

  next(): void {
    if (this.last()) void this.finish();
    else this.go(this.index() + 1);
  }

  async finish(): Promise<void> {
    await this.auth.markGuideSeen();
    await this.router.navigateByUrl(this.first() ? '/trips' : '/account', { replaceUrl: true });
  }

  onKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight') this.go(this.index() + 1);
    else if (event.key === 'ArrowLeft') this.go(this.index() - 1);
    else return;
    event.preventDefault();
  }

  /** 좌우로 밀어 넘긴다. 짧은 움직임은 누름으로 본다. */
  onPointerDown(event: PointerEvent): void {
    this.startX = event.clientX;
  }

  onPointerUp(event: PointerEvent): void {
    if (this.startX === null) return;
    const dx = event.clientX - this.startX;
    this.startX = null;
    if (Math.abs(dx) < 40) return;
    this.go(this.index() + (dx < 0 ? 1 : -1));
  }
}
