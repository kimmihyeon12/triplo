import { Injectable, computed, inject } from '@angular/core';
import { patchState, signalState } from '@ngrx/signals';
import { enumerateDays, validateTripDates } from '../../../shared/util/dates';
import { type KoreaRegion, searchRegions } from '../../../shared/util/korea-regions';
import { PLACE_SEARCH } from '../../places/data/place-search';
import { verifyPlaces } from '../util/verify-places';
import {
  type Phase,
  type AiPlanSelection,
  type PlanItem,
  type GenerateError,
} from '../model/ai-plan';
import { AI_PLAN_PROVIDER } from './ai-plan-provider';

/** 날짜를 정하지 않았을 때 쓰는 일수. 하루짜리로 만들면 추천이 너무 적다. */
const DEFAULT_DAY_COUNT = 2;

@Injectable()
export class AiPlanStore {
  private readonly provider = inject(AI_PLAN_PROVIDER);
  private readonly placeSearch = inject(PLACE_SEARCH);
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
    /** 생성해서 받은 목록. 만들기 전에는 비어 있다. */
    results: [] as readonly PlanItem[],
    selected: new Set<string>(),
    /** 사용자가 고친 일차. 추천 그대로 두는 항목은 여기에 없다. */
    dayOverrides: {} as Readonly<Record<string, number>>,
    error: null as GenerateError | null,
  });
  private readonly requestId = crypto.randomUUID();
  /** 생성 중인 요청을 취소하는 손잡이. */
  private running: AbortController | null = null;

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
  readonly results = this.state.results;
  readonly selected = this.state.selected;
  readonly dayOverrides = this.state.dayOverrides;
  readonly error = this.state.error;

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
   * 받은 결과의 마지막 일차까지만 둔다. 없는 날로 옮기면 담을 때 갈 곳이 없다.
   */
  readonly dayChoices = computed<readonly number[]>(() => {
    const count = this.dayCount();
    return Array.from({ length: count }, (_, i) => i + 1);
  });

  /** 요청에 넣을 일수. 날짜 미정이면 기본값을 쓴다. */
  readonly dayCount = computed(() => {
    const start = this.startDate();
    const end = this.endDate();
    if (this.dateValidation().ok && start && end) {
      const days = enumerateDays(start, end).length;
      if (days > 0) return days;
    }
    const received = this.results();
    return received.length ? Math.max(...received.map((i) => i.day)) : DEFAULT_DAY_COUNT;
  });

  /** 사용자가 고친 일차를 반영한 목록. 일차 순으로 다시 늘어놓는다. */
  readonly items = computed<readonly PlanItem[]>(() => {
    const overrides = this.dayOverrides();
    return this.results()
      .map((item) => {
        const day = overrides[item.id];
        return day === undefined || day === item.day ? item : { ...item, day };
      })
      .sort((a, b) => a.day - b.day);
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
    if (matches.length === 1) this.pickRegion(matches[0]!);
  }

  removeRegion(index: number): void {
    patchState(this.state, { regions: this.regions().filter((_, i) => i !== index) });
  }

  /** 결과가 모두 선택되어 있는지. 버튼 문구를 고르는 데 쓴다. */
  readonly allSelected = computed(() => {
    const results = this.results();
    return results.length > 0 && results.every((i) => this.selected().has(i.id));
  });

  toggle(id: string): void {
    if (!this.results().some((i) => i.id === id)) return;
    const selected = new Set(this.selected());
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    patchState(this.state, { selected });
  }

  /** 하나라도 빠져 있으면 모두 고르고, 모두 골라져 있으면 모두 뺀다. */
  toggleAll(): void {
    patchState(this.state, {
      selected: this.allSelected() ? new Set<string>() : new Set(this.results().map((i) => i.id)),
    });
  }

  /** 추천 일차를 사용자가 고친다. 고를 수 있는 범위 밖이면 무시한다. */
  setDay(id: string, day: number): void {
    if (!this.results().some((i) => i.id === id)) return;
    if (!this.dayChoices().includes(day)) return;
    patchState(this.state, { dayOverrides: { ...this.dayOverrides(), [id]: day } });
  }

  /**
   * 조건을 보내 일정 초안을 받는다. 받은 이름은 장소 검색으로 대조해
   * 실재를 확인한 것만 기본 선택한다. 실패하면 조건을 그대로 남긴다.
   */
  async generate(): Promise<void> {
    if (!this.canLeaveStep1() || this.phase() === 'generating') return;
    const controller = new AbortController();
    this.running = controller;
    patchState(this.state, { phase: 'generating', error: null });
    try {
      const items = await this.provider.generate(
        {
          regions: this.regions(),
          dayCount: this.dayCount(),
          companion: this.companion(),
          transport: this.transport(),
          pace: this.pace(),
          taste: this.taste(),
          mustGo: this.mustGo(),
          bookedStay: this.bookedStay(),
          extraNote: this.extraNote(),
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (!items.length) {
        patchState(this.state, {
          phase: 'summary',
          error: {
            kind: 'empty',
            message: 'AI가 쓸 만한 장소를 찾지 못했어요. 조건을 조금 바꿔 보세요.',
          },
        });
        return;
      }
      // 장소 검색으로 위치를 확인한 것만 남긴다. 찾지 못한 이름은 좌표가 없어
      // 지도에 올릴 수 없고, 사용자가 그 이름만 보고 판단하기도 어렵다.
      const found = (await verifyPlaces(items, this.regions(), this.placeSearch)).filter(
        (i) => i.verified,
      );
      if (controller.signal.aborted) return;
      if (!found.length) {
        patchState(this.state, {
          phase: 'summary',
          error: {
            kind: 'empty',
            message: '실제로 있는 장소를 찾지 못했어요. 조건을 조금 바꿔 보세요.',
          },
        });
        return;
      }
      patchState(this.state, {
        phase: 'result',
        results: found,
        selected: new Set(found.map((i) => i.id)),
        dayOverrides: {},
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      patchState(this.state, { phase: 'summary', error: toGenerateError(error) });
    } finally {
      if (this.running === controller) this.running = null;
    }
  }

  /** 기다리는 중에 그만두면 조건 화면으로 돌아간다. */
  cancel(): void {
    this.running?.abort();
    this.running = null;
    if (this.phase() === 'generating') patchState(this.state, { phase: 'summary', error: null });
  }

  /** 결과를 버리고 조건을 고치러 돌아간다. */
  backToSummary(): void {
    patchState(this.state, { phase: 'summary', error: null });
  }

  selection(): AiPlanSelection {
    return {
      requestId: this.requestId,
      regions: [...this.regions()],
      startDate: this.startDate() || null,
      endDate: this.endDate() || null,
      items: this.items().filter((i) => this.selected().has(i.id)),
    };
  }
}

function toGenerateError(error: unknown): GenerateError {
  const message = error instanceof Error ? error.message : '알 수 없는 오류가 생겼습니다.';
  if (message.includes('오늘 사용량')) return { kind: 'quota', message };
  if (message.includes('오래 걸립니다')) return { kind: 'timeout', message };
  // fetch가 네트워크에 닿지 못하면 'Failed to fetch'를 던진다.
  if (error instanceof TypeError)
    return {
      kind: 'offline',
      message: 'AI에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.',
    };
  return { kind: 'other', message };
}
