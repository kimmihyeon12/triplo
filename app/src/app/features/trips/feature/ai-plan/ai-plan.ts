import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PageBar } from '../../../../core/page-bar';
import { AiPlanFlow } from '../../../ai-planning/ai-planning';
import type { AiPlanSelection } from '../../../ai-planning/model/ai-plan';
import { TripEditorStore } from '../../data/trip-editor-store';
import { selectionToTrip } from '../../util/ai-selection';

@Component({
  selector: 'app-ai-plan',
  imports: [AiPlanFlow],
  providers: [TripEditorStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ai-plan.html',
})
export class AiPlanPage {
  readonly store = inject(TripEditorStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pageBar = inject(PageBar);

  constructor() {
    this.pageBar.set({ title: '일정 짜기', back: ['/trips'], action: null });
  }

  leave(): void {
    // 나가기도 저장과 같다. 조건 입력을 그만둔 화면이 히스토리에 남으면
    // 목록에서 뒤로 갔을 때 다시 나타난다.
    void this.router.navigate(['/trips'], { replaceUrl: true });
  }

  async apply(selection: AiPlanSelection): Promise<void> {
    if (this.store.saveState() === 'saving') return;
    const trip = selectionToTrip(selection);
    if ((await this.store.commit(trip)) && !this.destroyRef.destroyed)
      // 만들기 화면을 히스토리에서 치운다. 그대로 두면 상세에서 뒤로 갔을 때
      // 이미 만든 일정의 조건 입력 화면이 다시 나타난다.
      void this.router.navigate(['/trips', trip.id], { replaceUrl: true });
  }
}
