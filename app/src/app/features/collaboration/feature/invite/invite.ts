import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageBar } from '../../../../core/page-bar';
import { UiButton } from '../../../../shared/ui/button/button';

@Component({
  selector: 'app-invite',
  templateUrl: './invite.html',
  imports: [RouterLink, UiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Invite {
  readonly id = input.required<string>();

  constructor() {
    const bar = inject(PageBar);
    effect(() => bar.set({ title: '친구 초대', back: ['/trips', this.id()], action: null }));
  }
}
