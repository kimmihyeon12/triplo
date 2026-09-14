import { UiSpinner } from './shared/ui/spinner/spinner';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { IconComponent } from './shared/ui/icon/icon';
import { PageBar } from './core/page-bar';
import { PageTools } from './shared/ui/page-tools/page-tools';

@Component({
  selector: 'app-root',
  imports: [UiSpinner, RouterOutlet, RouterLink, IconComponent, PageTools],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
})
export class App {
  readonly navigating = inject(Router).currentNavigation;
  readonly showNavigationLoading = signal(false);
  private readonly pageBar = inject(PageBar);
  readonly bar = this.pageBar.state;

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
