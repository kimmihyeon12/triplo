import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { IconComponent } from './shared/ui/icon';
import { PageBar } from './core/page-bar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly pageBar = inject(PageBar);
  readonly bar = this.pageBar.state;
}
