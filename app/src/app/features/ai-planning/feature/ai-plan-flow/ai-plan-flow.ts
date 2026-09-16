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
import { kakaoSearchUrl, mapQuery, naverSearchUrl } from '../../../places/data/map-links';
import type { KoreaRegion } from '../../../../shared/util/korea-regions';
import { COMPANION, PACE, TRANSPORT, type Phase, type AiPlanSelection } from '../../model/ai-plan';

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
  /** 사용자가 고친 일차가 반영된 목록. 고정 SAMPLE_ITEMS를 직접 쓰지 않는다. */
  readonly sampleItems = this.draft.items;
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
  readonly dayChoices = this.draft.dayChoices;
  readonly useDayChips = this.draft.useDayChips;
  /** 당일 여행처럼 고를 일차가 하나뿐이면 바꿀 것이 없어 감춘다. */
  readonly canChangeDay = computed(() => this.dayChoices().length > 1);
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

  readonly regionMatches = this.draft.regionMatches;

  pickRegion(region: KoreaRegion): void {
    this.draft.pickRegion(region);
  }

  submitRegionSearch(event: Event): void {
    event.preventDefault();
    this.draft.submitRegionSearch();
  }

  removeRegion(index: number): void {
    this.draft.removeRegion(index);
  }

  toggle(id: string): void {
    this.draft.toggle(id);
  }

  /** select의 값은 문자열이므로 숫자로 바꿔 넘긴다. */
  changeDay(id: string, value: string): void {
    const day = Number(value);
    if (Number.isInteger(day)) this.draft.setDay(id, day);
  }

  /**
   * 장소를 네이버 지도에서 찾는 주소. 추천에는 좌표가 없으므로 이름과
   * 지역으로 검색한다. 리뷰·위치·영업시간은 그 화면에서 확인한다.
   */
  naverLink(name: string): string {
    return naverSearchUrl(this.mapSearch(name));
  }

  kakaoLink(name: string): string {
    return kakaoSearchUrl(this.mapSearch(name));
  }

  /** 지역을 앞에 붙여야 동명 장소가 섞이지 않는다. 예: '강릉 안목해변 카페거리' */
  private mapSearch(name: string): string {
    return mapQuery(this.regions()[0] ?? '', name);
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
