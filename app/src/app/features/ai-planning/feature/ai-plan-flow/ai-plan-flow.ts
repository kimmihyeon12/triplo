import { UiField } from '../../../../shared/ui/field/field';
import { UiActionBar } from '../../../../shared/ui/action-bar/action-bar';
import { UiNotice } from '../../../../shared/ui/notice/notice';
import { UiBadge } from '../../../../shared/ui/badge/badge';
import { UiInput } from '../../../../shared/ui/input/input';
import { UiButton } from '../../../../shared/ui/button/button';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { AiPlanStore } from '../../data/ai-plan-store';
import {
  COMPANION,
  PACE,
  TRANSPORT,
  SAMPLE_ITEMS,
  type Phase,
  type AiPlanSelection,
} from '../../model/ai-plan';

@Component({
  selector: 'app-ai-plan-flow',
  imports: [UiButton, UiInput, UiBadge, UiNotice, UiActionBar, UiField, FormsModule, IconComponent],
  providers: [AiPlanStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ai-plan-flow.html',
})
export class AiPlanFlow {
  readonly draft = inject(AiPlanStore);
  readonly saving = input(false);
  readonly saveFailed = input(false);
  readonly apply = output<AiPlanSelection>();
  readonly cancel = output<void>();
  readonly companions = COMPANION;
  readonly paces = PACE;
  readonly transports = TRANSPORT;
  readonly sampleItems = SAMPLE_ITEMS;
  readonly phase = this.draft.phase;
  readonly regions = this.draft.regions;
  readonly regionInput = this.draft.regionInput;
  readonly startDate = this.draft.startDate;
  readonly endDate = this.draft.endDate;
  readonly companion = this.draft.companion;
  readonly transport = this.draft.transport;
  readonly pace = this.draft.pace;
  readonly taste = this.draft.taste;
  readonly mustGo = this.draft.mustGo;
  readonly bookedStay = this.draft.bookedStay;
  readonly extraNote = this.draft.extraNote;
  readonly selected = this.draft.selected;
  readonly stepNumber = this.draft.stepNumber;
  readonly dateValidation = this.draft.dateValidation;
  readonly dateError = this.draft.dateError;
  readonly canLeaveStep1 = this.draft.canLeaveStep1;
  readonly summaryRows = computed(() => [
    { label: '지역', value: this.regions().join(' → '), phase: 'step1' as Phase },
    {
      label: '날짜',
      value:
        this.startDate() && this.endDate()
          ? `${this.startDate()} ~ ${this.endDate()}`
          : '날짜 미정',
      phase: 'step1' as Phase,
    },
    { label: '동행', value: this.companion(), phase: 'step2' as Phase },
    { label: '이동수단', value: this.transport(), phase: 'step2' as Phase },
    { label: '일정 밀도', value: this.pace(), phase: 'step2' as Phase },
    { label: '취향', value: this.taste(), phase: 'step2' as Phase },
    { label: '꼭 갈 장소', value: this.mustGo(), phase: 'step3' as Phase },
    { label: '정한 숙소', value: this.bookedStay(), phase: 'step3' as Phase },
    { label: '추가 요청', value: this.extraNote(), phase: 'step3' as Phase },
  ]);

  addRegion(event?: Event): void {
    event?.preventDefault();
    this.draft.addRegion();
  }

  removeRegion(index: number): void {
    this.draft.removeRegion(index);
  }

  toggle(id: string): void {
    this.draft.toggle(id);
  }

  generate(): void {
    this.draft.generate();
  }

  leave(event: Event): void {
    event.preventDefault();
    this.cancel.emit();
  }

  commit(): void {
    if (!this.saving() && this.selected().size) this.apply.emit(this.draft.selection());
  }
}
