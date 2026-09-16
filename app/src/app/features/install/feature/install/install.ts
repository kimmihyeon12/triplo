import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { PageBar } from '../../../../core/page-bar';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiNotice } from '../../../../shared/ui/notice/notice';
import { UiActionBar } from '../../../../shared/ui/action-bar/action-bar';
import { IconComponent } from '../../../../shared/ui/icon/icon';

/** 브라우저가 설치 가능 시점에 주는 이벤트. 표준 타입에 아직 없어 직접 좁힌다. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'android' | 'ios' | 'desktop';

@Component({
  selector: 'app-install',
  templateUrl: './install.html',
  imports: [UiButton, UiNotice, UiActionBar, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Install {
  /** 브라우저가 설치 신호를 줬을 때만 담긴다. 없으면 수동 안내로 넘어간다. */
  private readonly promptEvent = signal<InstallPromptEvent | null>(null);
  readonly canPrompt = computed(() => this.promptEvent() !== null);
  readonly installed = signal(false);
  readonly dismissed = signal(false);

  readonly platform = signal<Platform>('desktop');

  /** 이미 앱으로 실행 중이면 설치 안내가 필요 없다. */
  readonly runningAsApp = signal(false);

  readonly heading = computed(() => {
    if (this.runningAsApp()) return '이미 앱으로 보고 있어요';
    if (this.installed()) return '설치했어요';
    return '홈 화면에 추가하기';
  });

  constructor() {
    const bar = inject(PageBar);
    const destroyRef = inject(DestroyRef);

    effect(() => {
      // 로그인 전에도 열 수 있어 돌아갈 곳이 정해져 있지 않다. 뒤로가기를 두지 않는다.
      bar.set({ title: '앱 설치', back: null, action: null });
    });

    if (typeof window === 'undefined') return;

    const ua = navigator.userAgent;
    this.platform.set(
      /iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Android/i.test(ua) ? 'android' : 'desktop',
    );
    this.runningAsApp.set(
      window.matchMedia('(display-mode: standalone)').matches ||
        // iOS 사파리는 표준 display-mode 대신 이 값을 쓴다.
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
    );

    const onPrompt = (event: Event) => {
      // 기본 배너를 막고 우리 버튼으로 시점을 정한다.
      event.preventDefault();
      this.promptEvent.set(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      this.installed.set(true);
      this.promptEvent.set(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    destroyRef.onDestroy(() => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    });
  }

  async install(): Promise<void> {
    const event = this.promptEvent();
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    // 한 번 쓴 이벤트는 다시 쓸 수 없다. 거절했다면 수동 안내로 돌린다.
    this.promptEvent.set(null);
    if (outcome === 'dismissed') this.dismissed.set(true);
  }
}
