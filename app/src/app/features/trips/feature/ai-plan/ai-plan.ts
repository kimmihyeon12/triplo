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
    this.pageBar.set({ title: 'AI 일정 만들기', back: ['/trips'], action: null });
  }

  leave(): void {
    void this.router.navigate(['/trips']);
  }

  async apply(selection: AiPlanSelection): Promise<void> {
    if (this.store.saveState() === 'saving') return;
    const trip = selectionToTrip(selection);
    if ((await this.store.commit(trip)) && !this.destroyRef.destroyed)
      void this.router.navigate(['/trips', trip.id]);
  }
}
