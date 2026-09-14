import { Injectable, computed } from '@angular/core';
import { patchState, signalState } from '@ngrx/signals';
import { validateTripDates } from '../../../shared/util/dates';
import { SAMPLE_ITEMS, type Phase, type AiPlanSelection } from '../model/ai-plan';

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

  readonly stepNumber = computed(() =>
    this.phase() === 'step1' ? 1 : this.phase() === 'step2' ? 2 : 3,
  );
  readonly dateValidation = computed(() => validateTripDates(this.startDate(), this.endDate()));
  readonly dateError = computed(() => {
    const v = this.dateValidation();
    return v.ok ? null : v.message;
  });
  readonly canLeaveStep1 = computed(() => this.regions().length > 0 && this.dateValidation().ok);

  set<K extends keyof ReturnType<typeof this.state>>(
    key: K,
    value: ReturnType<typeof this.state>[K],
  ): void {
    patchState(this.state, { [key]: value });
  }

  addRegion(): void {
    const name = this.regionInput().trim();
    if (name) patchState(this.state, { regions: [...this.regions(), name], regionInput: '' });
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

  generate(): void {
    if (this.canLeaveStep1()) patchState(this.state, { phase: 'result' });
  }

  selection(): AiPlanSelection {
    return {
      requestId: this.requestId,
      regions: [...this.regions()],
      startDate: this.startDate() || null,
      endDate: this.endDate() || null,
      items: SAMPLE_ITEMS.filter((i) => i.verified && this.selected().has(i.id)),
    };
  }
}
