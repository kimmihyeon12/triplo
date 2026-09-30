import { Location } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router, type Params } from '@angular/router';

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
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  /** 지금 화면의 주소. 다음 이동에서 '어디서 왔는지'로 쓴다. */
  private current = '';
  /** 화면 경로마다 앞으로 이동해 들어오기 직전의 경로. 폼을 떠날 때 되돌아갈지 정한다. */
  private readonly cameFrom = new Map<string, string>();

  constructor() {
    const router = this.router;
    router.events.subscribe((event) => {
      if (!(event instanceof NavigationEnd)) return;
      if (this.first) {
        this.first = false;
        this.current = event.urlAfterRedirects;
        return;
      }
      const navigation = router.lastSuccessfulNavigation();
      const previous = this.current;
      this.current = event.urlAfterRedirects;
      // 주소를 바꿔 치운 이동(탭 전환 등)은 기록을 쌓지 않으므로 세지 않는다.
      if (navigation?.extras.replaceUrl) return;
      // 뒤로·앞으로는 기록을 오가는 것이라 되짚을 거리가 줄어든다.
      if (navigation?.trigger === 'popstate') {
        this.moves.update((n) => Math.max(0, n - 1));
        return;
      }
      this.cameFrom.set(pathOf(this.current), pathOf(previous));
      this.moves.update((n) => n + 1);
    });
  }

  /** 되짚어 갈 화면이 이 앱 안에 있는지. */
  canGoBack(): boolean {
    return this.moves() > 0;
  }

  /**
   * 일을 마친 폼(여행·장소·숙소 편집)을 떠나 목적지(상세)로 간다.
   *
   * 앞으로 이동하면 기록이 '목록 → 상세 → 폼 → 상세'가 되어 뒤로 가면 방금
   * 저장한 폼이 다시 나온다. 폼 자리를 상세로 바꿔 치워도 상세에서 들어왔다면
   * '목록 → 상세 → 상세'가 되어 뒤로 가도 같은 화면에 머문다.
   *
   * - 목적지에서 들어온 폼이면 기록을 한 칸 되돌린다. 되돌아간 화면의 날짜·탭이
   *   다르면 그 자리에서 주소만 바꿔 방금 저장한 내용이 보이게 한다.
   * - 다른 곳(목록 등)에서 들어왔거나 주소를 직접 열었으면 폼 자리를 목적지로
   *   바꾼다. 기록은 '목록 → 상세'가 되어 뒤로 가면 목록이다.
   */
  leave(commands: readonly unknown[], queryParams: Params = {}): void {
    const target = this.router.createUrlTree([...commands], { queryParams });
    const wanted = this.router.serializeUrl(target);
    const from = this.cameFrom.get(pathOf(this.router.url));
    if (!this.canGoBack() || from !== pathOf(wanted)) {
      void this.router.navigateByUrl(target, { replaceUrl: true });
      return;
    }
    const sub = this.router.events.subscribe((event) => {
      if (!(event instanceof NavigationEnd)) return;
      sub.unsubscribe();
      if (event.urlAfterRedirects !== wanted)
        void this.router.navigateByUrl(target, { replaceUrl: true });
    });
    this.location.back();
  }
}

/** 주소에서 물음표·해시 앞의 경로만 남긴다. 같은 화면의 날짜·탭 차이는 무시한다. */
function pathOf(url: string): string {
  return url.split(/[?#]/)[0];
}
