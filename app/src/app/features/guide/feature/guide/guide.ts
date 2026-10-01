import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../../auth/data/auth-store';
import { PageBar } from '../../../../core/page-bar';
import { UiButton } from '../../../../shared/ui/button/button';
import { GUIDE_SLIDES, guideImage } from '../../model/guide';
import { GUIDE_MARKS, GUIDE_SHOT } from '../../model/guide-marks';
import { fitShot, layoutSpots, type Rect, type SpotLayout } from '../../util/spotlight';

/**
 * 앱 사용법. 처음 가입한 사람은 닉네임을 정한 직후에 보고(?first=1), 내 정보의 '사용법 보기'로
 * 언제든 다시 본다. 끝까지 보거나 건너뛰면 본 것으로 남긴다.
 * 장마다 실제 앱 캡처가 화면을 채우고, 회색 덮개 위에 설명할 요소만 밝게 남겨 설명 글을 단다.
 * 좌우로 밀어 넘기고, 건너뛰기는 상단 바에 둔다.
 */
@Component({
  selector: 'app-guide',
  imports: [UiButton],
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
  readonly last = computed(() => this.index() === this.slides.length - 1);

  readonly image = guideImage;
  /** 캡처를 보여 줄 자리의 크기. 화면 크기가 바뀌면 다시 잰다. */
  private readonly size = signal({ width: 360, height: 537 });
  /** 캡처를 스크롤 없이 다 보이게 맞춘 위치(위쪽 맞춤, 가운데). 모든 장이 같은 크기로 찍힌다. */
  readonly shot = computed<Rect>(() => fitShot(GUIDE_SHOT, this.size().width, this.size().height));
  /** 장마다 밝게 남길 자리와 설명 글의 배치. */
  readonly layouts = computed<readonly SpotLayout[]>(() => {
    const shot = this.shot();
    // 줄어든 캡처 옆 빈자리에도 말풍선을 둘 수 있게 자리 전체에 배치한다.
    const { width, height } = this.size();
    this.fontsReady();
    return this.slides.map((slide) => {
      const spots = (GUIDE_MARKS[slide.key] ?? []).flatMap((m) => {
        const label = slide.spots[m.spot];
        if (!label) return [];
        return [{
          x: shot.x + (m.x / 100) * shot.w,
          y: shot.y + (m.y / 100) * shot.h,
          w: (m.w / 100) * shot.w,
          h: (m.h / 100) * shot.h,
          label,
        }];
      });
      return layoutSpots(spots, width, height, this.measure);
    });
  });
  /** 글꼴이 늦게 들어오면 글 폭을 다시 잰다. */
  private readonly fontsReady = signal(0);
  /** 설명 글의 실제 폭을 화면 글꼴로 잰다. 박스가 글에 꼭 맞고 크기가 고르게 보인다. */
  private readonly measure = (() => {
    const ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
    if (!ctx) return undefined;
    ctx.font = `500 11px ${getComputedStyle(document.body).fontFamily}`;
    return (text: string) => ctx.measureText(text).width;
  })();
  /** 끄는 동안 손가락을 따라 움직인 거리(px). */
  readonly dragX = signal(0);
  readonly dragging = signal(false);
  readonly track = computed(() => `translateX(calc(${-this.index() * 100}% + ${this.dragX()}px))`);

  private readonly viewport = viewChild<ElementRef<HTMLElement>>('viewport');
  private startX: number | null = null;

  constructor() {
    inject(PageBar).set({
      title: '사용법',
      back: ['/account'],
      action: { label: '건너뛰기', run: () => void this.finish(), testId: 'guide-skip' },
    });
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.viewport()?.nativeElement;
      if (!el) return;
      const read = () => this.size.set({ width: el.clientWidth, height: el.clientHeight });
      read();
      void document.fonts?.ready.then(() => this.fontsReady.update((v) => v + 1));
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(read);
      observer.observe(el);
      destroy.onDestroy(() => observer.disconnect());
    });
  }

  go(i: number): void {
    this.index.set(Math.max(0, Math.min(this.slides.length - 1, i)));
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

  /** 좌우로 끌어 넘긴다. 끄는 동안 화면이 손가락을 따라오고, 화면 폭의 1/5을 넘기면 다음 장으로 간다. */
  onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.startX = event.clientX;
    this.dragging.set(true);
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    if (this.startX === null) return;
    const dx = event.clientX - this.startX;
    // 처음과 끝 장에서는 더 끌리지 않는 것처럼 무겁게 한다.
    const edge = (dx > 0 && this.index() === 0) || (dx < 0 && this.last());
    this.dragX.set(edge ? dx / 4 : dx);
  }

  onPointerUp(event: PointerEvent): void {
    if (this.startX === null) return;
    const dx = event.clientX - this.startX;
    const width = this.viewport()?.nativeElement.clientWidth ?? 360;
    this.startX = null;
    this.dragging.set(false);
    this.dragX.set(0);
    if (Math.abs(dx) < Math.min(80, width / 5)) return;
    this.go(this.index() + (dx < 0 ? 1 : -1));
  }
}
