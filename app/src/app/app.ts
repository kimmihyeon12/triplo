import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import {
  RouteConfigLoadEnd,
  RouteConfigLoadStart,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { IconComponent } from './shared/ui/icon/icon';
import { NavigationHistory } from './core/navigation-history';
import { PageBar } from './core/page-bar';
import { PageTools } from './shared/ui/page-tools/page-tools';
import { UiToast } from './shared/ui/toast/toast';
import { ToastService } from './core/toast-service';
import { NetworkActivity } from './core/network-activity';
import { AuthStore } from './features/auth/data/auth-store';
import {
  PendingDraftRegistry,
  sessionWatcher,
} from './features/trips/data/pending-draft-registry';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, IconComponent, PageTools, UiToast],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  readonly toast = inject(ToastService);
  readonly navigating = this.router.currentNavigation;
  private readonly network = inject(NetworkActivity);
  /** 네트워크 요청이 진행 중일 때만, 지연 없이 상단 바에 로딩을 보인다. */
  readonly showNavigationLoading = this.network.busy;
  private readonly pageBar = inject(PageBar);
  readonly bar = this.pageBar.state;
  private readonly location = inject(Location);
  private readonly history = inject(NavigationHistory);

  /**
   * 뒤로 가기 주소. 화면이 지정한 경로를 링크로 보여 주소 확인·새 탭 열기가
   * 그대로 되게 한다. 실제 이동은 goBack이 맡는다.
   */
  readonly backHref = computed(() => {
    const back = this.bar().back;
    if (!back) return null;
    return this.router.serializeUrl(
      this.router.createUrlTree(back, { queryParams: this.bar().backQueryParams ?? {} }),
    );
  });

  /**
   * ‹ 는 들어온 길을 되짚는다. 새로 이동하면 기록이 쌓이고, 그 뒤 제스처로
   * 뒤로가면 방금 나온 화면으로 되돌아가 사용자가 갇힌 것처럼 느낀다.
   *
   * 되짚을 기록이 없으면(주소를 직접 열었거나 새 탭으로 들어온 경우) 화면이
   * 지정한 경로로 이동한다. 그때 기록을 되감으면 앱 밖으로 나가 버린다.
   *
   * 새 탭·다른 버튼 클릭은 건드리지 않고 링크 기본 동작에 맡긴다.
   */
  goBack(event: MouseEvent): void {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    if (this.history.canGoBack()) {
      this.location.back();
      return;
    }
    const back = this.bar().back;
    if (back) void this.router.navigate(back, { queryParams: this.bar().backQueryParams ?? {} });
  }

  constructor() {
    // 처음 여는 화면의 코드 내려받기도 네트워크 요청으로 센다.
    this.router.events.subscribe((event) => {
      if (event instanceof RouteConfigLoadStart) this.network.begin();
      else if (event instanceof RouteConfigLoadEnd) this.network.end();
    });
    // 로그인 계정이 바뀌면 이전 계정의 저장 대기열과 화면 상태를 버린다.
    const auth = inject(AuthStore);
    const pending = inject(PendingDraftRegistry);
    const watch = sessionWatcher((session) => pending.changeSession(session));
    effect(() => watch(auth.loading(), auth.user()?.id ?? null));
  }
}
