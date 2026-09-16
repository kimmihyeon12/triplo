import { Injectable, computed } from '@angular/core';
import { patchState, signalState } from '@ngrx/signals';
import { enumerateDays, validateTripDates } from '../../../shared/util/dates';
import { type KoreaRegion, searchRegions } from '../../../shared/util/korea-regions';
import { SAMPLE_ITEMS, type Phase, type AiPlanSelection, type SampleItem } from '../model/ai-plan';

@Injectable()
export class AiPlanStore {
  private readonly state = signalState({
    phase: 'step1' as Phase,
    regions: [] as string[],
    regionInput: '',
    startDate: '',
    endDate: '',
    companion: '친구',
    transport: '자가용',
    pace: '보통',
    taste: '',
    mustGo: '',
    bookedStay: '',
    extraNote: '',
    selected: new Set(SAMPLE_ITEMS.filter((i) => i.verified).map((i) => i.id)),
    /** 사용자가 고친 일차. 추천 그대로 두는 항목은 여기에 없다. */
    dayOverrides: {} as Readonly<Record<string, number>>,
  });
  private readonly requestId = crypto.randomUUID();
  readonly phase = this.state.phase;
  readonly regions = this.state.regions;
  readonly regionInput = this.state.regionInput;
  readonly startDate = this.state.startDate;
  readonly endDate = this.state.endDate;
  readonly companion = this.state.companion;
  readonly transport = this.state.transport;
  readonly pace = this.state.pace;
  readonly taste = this.state.taste;
  readonly mustGo = this.state.mustGo;
  readonly bookedStay = this.state.bookedStay;
  readonly extraNote = this.state.extraNote;
  readonly selected = this.state.selected;
  readonly dayOverrides = this.state.dayOverrides;

  readonly stepNumber = computed(() =>
    this.phase() === 'step1' ? 1 : this.phase() === 'step2' ? 2 : 3,
  );
  readonly dateValidation = computed(() => validateTripDates(this.startDate(), this.endDate()));
  readonly dateError = computed(() => {
    const v = this.dateValidation();
    return v.ok ? null : v.message;
  });
  readonly canLeaveStep1 = computed(() => this.regions().length > 0 && this.dateValidation().ok);

  /**
   * 고를 수 있는 일차. 날짜를 정했으면 그 기간의 일수를 쓰고, 날짜 미정이면
   * 추천에 나온 마지막 일차까지만 둔다. 없는 날로 옮기면 담을 때 갈 곳이 없다.
   */
  readonly dayChoices = computed<readonly number[]>(() => {
    const start = this.startDate();
    const end = this.endDate();
    const recommended = Math.max(...SAMPLE_ITEMS.map((i) => i.day));
    const count =
      this.dateValidation().ok && start && end
        ? enumerateDays(start, end).length || recommended
        : recommended;
    return Array.from({ length: count }, (_, i) => i + 1);
  });

  /**
   * 일차를 칩으로 늘어놓을지 정한다. 5일까지는 한 줄에 들어가 한 번에
   * 바꿀 수 있지만, 그보다 길면 칩이 너무 많아져 드롭다운이 낫다.
   */
  readonly useDayChips = computed(() => this.dayChoices().length <= 5);

  /** 사용자가 고친 일차를 반영한 추천 목록. 일차 순으로 다시 늘어놓는다. */
  readonly items = computed<readonly SampleItem[]>(() => {
    const overrides = this.dayOverrides();
    return SAMPLE_ITEMS.map((item) => {
      const day = overrides[item.id];
      return day === undefined || day === item.day ? item : { ...item, day };
    }).sort((a, b) => a.day - b.day);
  });

  set<K extends keyof ReturnType<typeof this.state>>(
    key: K,
    value: ReturnType<typeof this.state>[K],
  ): void {
    patchState(this.state, { [key]: value });
  }

  /**
   * 입력한 글자로 찾은 지역 후보. 이미 담은 지역은 빼서 같은 곳을
   * 두 번 넣지 않게 한다. 여행 만들기와 같은 고정 목록을 쓴다.
   */
  readonly regionMatches = computed<readonly KoreaRegion[]>(() => {
    const picked = new Set(this.regions());
    return searchRegions(this.regionInput(), 8).filter((r) => !picked.has(r.name));
  });

  /** 후보 목록에서 고른 지역을 담는다. 지명은 목록의 표기를 그대로 쓴다. */
  pickRegion(region: KoreaRegion): void {
    patchState(this.state, { regions: [...this.regions(), region.name], regionInput: '' });
  }

  /**
   * 엔터로는 후보가 하나로 좁혀졌을 때만 담는다. 여럿이면 어느 곳인지
   * 알 수 없으므로 사용자가 직접 고르게 둔다.
   */
  submitRegionSearch(): void {
    const matches = this.regionMatches();
    if (matches.length === 1) this.pickRegion(matches[0]);
  }

  removeRegion(index: number): void {
    patchState(this.state, { regions: this.regions().filter((_, i) => i !== index) });
  }

  toggle(id: string): void {
    if (!SAMPLE_ITEMS.some((i) => i.id === id && i.verified)) return;
    const selected = new Set(this.selected());
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    patchState(this.state, { selected });
  }

  /** 추천 일차를 사용자가 고친다. 고를 수 있는 범위 밖이면 무시한다. */
  setDay(id: string, day: number): void {
    if (!SAMPLE_ITEMS.some((i) => i.id === id)) return;
    if (!this.dayChoices().includes(day)) return;
    patchState(this.state, { dayOverrides: { ...this.dayOverrides(), [id]: day } });
  }

  generate(): void {
    if (this.canLeaveStep1()) patchState(this.state, { phase: 'result' });
  }

  selection(): AiPlanSelection {
    return {
      requestId: this.requestId,
      regions: [...this.regions()],
      startDate: this.startDate() || null,
      endDate: this.endDate() || null,
      items: this.items().filter((i) => i.verified && this.selected().has(i.id)),
    };
  }
}
