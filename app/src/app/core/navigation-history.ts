import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

/**
 * 이 앱 안에서 화면을 옮겨 다닌 적이 있는지 기억한다.
 *
 * 상단 바의 ‹ 는 들어온 길을 되짚어야 한다. 그런데 주소를 직접 열었거나 다른
 * 사이트에서 새 탭으로 들어온 경우에는 되짚을 곳이 없다. 그때 기록을 되감으면
 * 앱 밖으로 나가 버리므로, 그런 상황에서는 지정된 경로로 이동해야 한다.
 *
 * `history.length`만으로는 구분할 수 없다. 다른 사이트를 보다 들어와도 그 값은
 * 1보다 크기 때문이다. 그래서 앱이 직접 센다.
 */
@Injectable({ providedIn: 'root' })
export class NavigationHistory {
  /**
   * 앱이 뜬 뒤 화면을 옮긴 횟수. 브라우저가 처음 연 화면은 이동이 아니므로
   * 세지 않는다. 그래서 첫 NavigationEnd는 건너뛴다.
   */
  private readonly moves = signal(0);
  private first = true;

  constructor() {
    const router = inject(Router);
    router.events.subscribe((event) => {
      if (!(event instanceof NavigationEnd)) return;
      if (this.first) {
        this.first = false;
        return;
      }
      const navigation = router.lastSuccessfulNavigation();
      // 주소를 바꿔 치운 이동(탭 전환 등)은 기록을 쌓지 않으므로 세지 않는다.
      if (navigation?.extras.replaceUrl) return;
      // 뒤로·앞으로는 기록을 오가는 것이라 되짚을 거리가 줄어든다.
      if (navigation?.trigger === 'popstate') {
        this.moves.update((n) => Math.max(0, n - 1));
        return;
      }
      this.moves.update((n) => n + 1);
    });
  }

  /** 되짚어 갈 화면이 이 앱 안에 있는지. */
  canGoBack(): boolean {
    return this.moves() > 0;
  }
}
