import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { IconComponent } from './shared/ui/icon/icon';
import { NavigationHistory } from './core/navigation-history';
import { PageBar } from './core/page-bar';
import { PageTools } from './shared/ui/page-tools/page-tools';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, IconComponent, PageTools],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  readonly navigating = this.router.currentNavigation;
  readonly showNavigationLoading = signal(false);
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
    effect((onCleanup) => {
      const navigation = this.navigating();
      this.showNavigationLoading.set(false);
      if (!navigation) return;
      const timer = setTimeout(() => this.showNavigationLoading.set(true), 200);
      onCleanup(() => clearTimeout(timer));
    });
  }
}
