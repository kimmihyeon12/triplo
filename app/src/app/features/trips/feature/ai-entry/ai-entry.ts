import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { PageBar } from '../../../../core/page-bar';

/**
 * AI로 일정을 만드는 두 가지 방식 중 하나를 고르는 화면.
 *
 * 여행 목록에 진입점을 둘로 늘리지 않기 위해 둔 화면이다. 상단에 이미 있는
 * `AI 일정 만들기` 옆에 챗봇 버튼을 따로 띄우면 한 화면에 AI 진입점이 둘이
 * 되어, 사용자가 누를 때마다 둘의 차이를 판단해야 한다. 실제로는 같은 목적에
 * 방식만 다르므로 진입점은 하나로 두고 여기서 고르게 한다.
 *
 * 조건이 정해진 사용자에게는 단계형이 빠르고, 어디로 갈지 정하지 못한
 * 사용자에게는 대화형이 필요하다. 어느 쪽인지는 사용자만 안다.
 */
@Component({
  selector: 'app-ai-entry',
  templateUrl: './ai-entry.html',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiEntryPage {
  constructor() {
    inject(PageBar).set({ title: 'AI로 일정 만들기', back: ['/trips'], action: null });
  }
}
