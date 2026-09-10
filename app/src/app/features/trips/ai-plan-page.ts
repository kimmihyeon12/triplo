import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TripStore } from '../../data/trip-store';
import { addDays, diffDays, validateTripDates } from '../../domain/dates';
import { appendStop, } from '../../domain/itinerary';
import { createRegion, createStop, createTrip, type Trip, type TripRegion } from '../../domain/model';
import { IconComponent } from '../../shared/icon';
import { PageBar } from '../../shared/page-bar';

/** 3단계 입력 → 조건 요약 → 샘플 결과 선택. */
type Phase = 'step1' | 'step2' | 'step3' | 'summary' | 'result';

interface SampleItem {
  readonly id: string;
  readonly day: number;
  readonly name: string;
  readonly kindLabel: string;
  readonly note: string;
  /** 좌표가 확인된 항목만 기본 선택 대상이다. */
  readonly verified: boolean;
}

/**
 * 샘플 결과. 실제 LLM 키가 없으므로 고정 목데이터다.
 * 화면에 '샘플 결과'로 명확히 라벨링하며 실제 연동으로 위장하지 않는다.
 */
const SAMPLE_ITEMS: readonly SampleItem[] = [
  { id: 's1', day: 1, name: '안목해변 카페거리', kindLabel: '장소', note: '바다 옆 카페 거리', verified: true },
  { id: 's2', day: 1, name: '초당순두부마을', kindLabel: '식사', note: '점심 후보', verified: true },
  { id: 's3', day: 1, name: '오죽헌', kindLabel: '장소', note: '실내 위주', verified: true },
  { id: 's4', day: 2, name: '속초 중앙시장', kindLabel: '장소', note: '먹거리 골목', verified: true },
  { id: 's5', day: 2, name: '설악산 케이블카', kindLabel: '장소', note: '기상에 따라 운휴', verified: true },
  { id: 's6', day: 2, name: '이름 미확인 전망 카페', kindLabel: '장소', note: '위치 미확인 — 직접 확인 필요', verified: false },
];

const COMPANION = ['혼자', '친구', '연인', '가족'] as const;
const PACE = ['여유롭게', '보통', '알차게'] as const;
const TRANSPORT = ['자가용', '대중교통', '도보 중심'] as const;

@Component({
  selector: 'app-ai-plan-page',
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <!-- 진행 표시: 조건 입력 3단계 -->
      @if (phase() === 'step1' || phase() === 'step2' || phase() === 'step3') {
        <p class="steps" data-testid="ai-steps">
          @for (n of [1, 2, 3]; track n) {
            <span class="steps__dot" [class.steps__dot--on]="stepNumber() >= n" aria-hidden="true"></span>
          }
          <span class="steps__text">{{ stepNumber() }}단계 / 3</span>
        </p>
      }

      @switch (phase()) {
        <!-- 1단계: 지역·방문 순서·날짜 (필수) -->
        @case ('step1') {
          <section class="panel" data-testid="ai-step-1">
            <h2 class="sec">어디로, 언제 가나요?</h2>
            <p class="sec__hint">지역은 방문할 순서대로 넣으세요. 날짜는 비워 두면 ‘날짜 미정’ 초안이 됩니다.</p>

            <div class="field">
              <label class="field__label" for="ai-region">지역 (순서대로)</label>
              <div class="row region-add">
                <input id="ai-region" class="input" [ngModel]="regionInput()" (ngModelChange)="regionInput.set($event)" name="aiRegion" placeholder="예: 강릉" maxlength="30" (keydown.enter)="addRegion($event)" data-testid="ai-region-input" />
                <button type="button" class="btn" (click)="addRegion()" data-testid="ai-region-add">추가</button>
              </div>
            </div>

            @if (regions().length > 0) {
              <ol class="regions" data-testid="ai-region-list">
                @for (r of regions(); track r; let i = $index) {
                  <li class="region">
                    <span class="cell cell--solid-accent region__no">{{ i + 1 }}</span>
                    <span class="region__name">{{ r }}</span>
                    <button type="button" class="btn btn--icon" (click)="removeRegion(i)" [attr.aria-label]="r + ' 삭제'"><app-icon name="x" [size]="16" /></button>
                  </li>
                }
              </ol>
            }

            <div class="field-row" style="margin-top:16px">
              <div class="field">
                <label class="field__label" for="ai-start">시작일</label>
                <input id="ai-start" type="date" class="input" [ngModel]="startDate()" (ngModelChange)="startDate.set($event)" name="aiStart" data-testid="ai-start" />
              </div>
              <div class="field">
                <label class="field__label" for="ai-end">종료일</label>
                <input id="ai-end" type="date" class="input" [ngModel]="endDate()" (ngModelChange)="endDate.set($event)" name="aiEnd" data-testid="ai-end" />
              </div>
            </div>
            @if (dateError()) {
              <p class="field__error" role="alert" data-testid="ai-date-error">{{ dateError() }}</p>
            }
          </section>
        }

        <!-- 2단계: 동행·취향·이동수단·밀도 (선택, 기본값 있음) -->
        @case ('step2') {
          <section class="panel" data-testid="ai-step-2">
            <h2 class="sec">어떻게 다니나요?</h2>
            <p class="sec__hint">모두 선택 사항입니다. 그대로 두고 건너뛰어도 됩니다.</p>

            <div class="field">
              <span class="field__label" id="ai-companion-label">동행</span>
              <div class="chips" role="radiogroup" aria-labelledby="ai-companion-label">
                @for (c of companions; track c) {
                  <label class="pick" [class.pick--on]="companion() === c">
                    <input type="radio" name="aiCompanion" [checked]="companion() === c" (change)="companion.set(c)" />
                    <span>{{ c }}</span>
                  </label>
                }
              </div>
            </div>

            <div class="field">
              <span class="field__label" id="ai-transport-label">이동수단</span>
              <div class="chips" role="radiogroup" aria-labelledby="ai-transport-label">
                @for (t of transports; track t) {
                  <label class="pick" [class.pick--on]="transport() === t">
                    <input type="radio" name="aiTransport" [checked]="transport() === t" (change)="transport.set(t)" />
                    <app-icon name="car" [size]="14" />
                    <span>{{ t }}</span>
                  </label>
                }
              </div>
            </div>

            <div class="field">
              <span class="field__label" id="ai-pace-label">일정 밀도</span>
              <div class="chips" role="radiogroup" aria-labelledby="ai-pace-label">
                @for (p of paces; track p) {
                  <label class="pick" [class.pick--on]="pace() === p">
                    <input type="radio" name="aiPace" [checked]="pace() === p" (change)="pace.set(p)" />
                    <span>{{ p }}</span>
                  </label>
                }
              </div>
            </div>

            <div class="field">
              <label class="field__label" for="ai-taste">취향 <span class="muted">(선택)</span></label>
              <input id="ai-taste" class="input" [ngModel]="taste()" (ngModelChange)="taste.set($event)" name="aiTaste" placeholder="예: 바다, 카페, 사진" maxlength="80" data-testid="ai-taste" />
            </div>
          </section>
        }

        <!-- 3단계: 꼭 갈 장소·숙소·추가 요청 (선택) -->
        @case ('step3') {
          <section class="panel" data-testid="ai-step-3">
            <h2 class="sec">꼭 넣을 것이 있나요?</h2>
            <p class="sec__hint">모두 선택 사항입니다. 없으면 건너뛰세요.</p>

            <div class="field">
              <label class="field__label" for="ai-must">꼭 갈 장소</label>
              <input id="ai-must" class="input" [ngModel]="mustGo()" (ngModelChange)="mustGo.set($event)" name="aiMust" placeholder="예: 안목해변, 속초 중앙시장" maxlength="200" data-testid="ai-must" />
            </div>
            <div class="field">
              <label class="field__label" for="ai-stay">이미 정한 숙소·예약</label>
              <input id="ai-stay" class="input" [ngModel]="bookedStay()" (ngModelChange)="bookedStay.set($event)" name="aiStay" placeholder="예: 강릉 A 호텔 2박" maxlength="200" data-testid="ai-stay" />
            </div>
            <div class="field">
              <label class="field__label" for="ai-note">추가 요청</label>
              <textarea id="ai-note" class="textarea" [ngModel]="extraNote()" (ngModelChange)="extraNote.set($event)" name="aiNote" maxlength="300" data-testid="ai-note"></textarea>
            </div>
          </section>
        }

        <!-- 조건 요약: 각 항목을 눌러 수정한 뒤에야 생성이 실행된다 -->
        @case ('summary') {
          <section class="panel" data-testid="ai-summary">
            <h2 class="sec">이 조건으로 만들까요?</h2>
            <p class="sec__hint">항목을 눌러 고칠 수 있습니다. [AI 일정 만들기]를 눌러야 생성됩니다.</p>
            <ul class="sum">
              @for (row of summaryRows(); track row.label) {
                <li>
                  <button type="button" class="sum__row" (click)="phase.set(row.phase)" [attr.data-testid]="'ai-summary-edit-' + row.phase">
                    <span class="sum__label">{{ row.label }}</span>
                    <span class="sum__value" [class.muted]="!row.value">{{ row.value || '지정 안 함' }}</span>
                    <app-icon name="chevron-right" [size]="16" />
                  </button>
                </li>
              }
            </ul>
          </section>

          <div class="notice notice--warn">
            <app-icon name="alert" />
            <div class="notice__body">
              실제 AI 제공자가 아직 연결되지 않았습니다. 지금 만들어지는 일정은 <strong>고정된 샘플 결과</strong>이며 실제 추천이 아닙니다.
            </div>
          </div>
        }

        <!-- 결과: 검증된 항목이 전체 선택된 상태로 시작. 담기를 눌러야 반영된다. -->
        @case ('result') {
          <div class="notice notice--warn" data-testid="ai-sample-notice">
            <app-icon name="alert" />
            <div class="notice__body">
              <strong>샘플 결과</strong>입니다. 실제 AI가 만든 추천이 아니라 고정된 예시이며, 위치·영업정보는 확인되지 않았습니다.
            </div>
          </div>

          <section class="panel" data-testid="ai-result">
            <h2 class="sec">추천 일정</h2>
            <p class="sec__hint">확인된 항목이 모두 선택되어 있습니다. 원치 않는 항목을 해제한 뒤 아래 버튼으로 담으세요.</p>
            <ul class="picks">
              @for (item of sampleItems; track item.id) {
                <li class="pickrow" [class.pickrow--on]="selected().has(item.id)">
                  <label class="pickrow__label">
                    <input type="checkbox" [checked]="selected().has(item.id)" (change)="toggle(item.id)" [attr.data-testid]="'ai-pick-' + item.id" />
                    <span class="pickrow__main">
                      <span class="pickrow__title">
                        <strong>{{ item.name }}</strong>
                        <span class="cell cell--place">{{ item.kindLabel }}</span>
                        @if (item.verified) {
                          <span class="cell cell--ok"><app-icon name="pin" [size]="12" /> 위치 확인됨</span>
                        } @else {
                          <span class="cell cell--warn">위치 미확인</span>
                        }
                      </span>
                      <span class="pickrow__meta small muted">{{ item.day }}일차 · {{ item.note }}</span>
                    </span>
                  </label>
                </li>
              }
            </ul>
          </section>
        }
      }

      <!-- 하단 고정 바: 단계별 다음 동작 -->
      <div class="action-bar">
        <div class="action-bar__inner">
          @switch (phase()) {
            @case ('step1') {
              <a class="btn" href="/trips" (click)="leave($event)">그만두기</a>
              <button type="button" class="btn btn--primary" [disabled]="!canLeaveStep1()" (click)="phase.set('step2')" data-testid="ai-next-1">다음</button>
            }
            @case ('step2') {
              <button type="button" class="btn" (click)="phase.set('step1')">이전</button>
              <button type="button" class="btn btn--primary" (click)="phase.set('step3')" data-testid="ai-next-2">다음</button>
            }
            @case ('step3') {
              <button type="button" class="btn" (click)="phase.set('step2')">이전</button>
              <button type="button" class="btn btn--primary" (click)="phase.set('summary')" data-testid="ai-next-3">조건 확인</button>
            }
            @case ('summary') {
              <button type="button" class="btn" (click)="phase.set('step3')">이전</button>
              <button type="button" class="btn btn--primary" (click)="generate()" data-testid="ai-generate"><app-icon name="sparkle" [size]="16" /> AI 일정 만들기</button>
            }
            @case ('result') {
              <button type="button" class="btn" (click)="phase.set('summary')" data-testid="ai-back-summary">조건 고치기</button>
              <button type="button" class="btn btn--primary" [disabled]="selected().size === 0 || saving()" (click)="commit()" data-testid="ai-commit">
                선택한 장소 {{ selected().size }}개 일정에 담기
              </button>
            }
          }
        </div>
      </div>

      @if (store.saveState() === 'error') {
        <div class="notice notice--danger" role="alert">
          <app-icon name="alert" />
          <div class="notice__body"><strong>저장에 실패했습니다.</strong> 선택한 항목은 그대로 남아 있습니다.</div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .steps {
        display: flex;
        align-items: center;
        gap: var(--sp-1);
      }
      .steps__dot {
        width: 22px;
        height: 3px;
        border-radius: var(--radius-pill);
        background: var(--border);
      }
      .steps__dot--on {
        background: var(--accent-deep);
      }
      .steps__text {
        margin-left: var(--sp-2);
        font-size: var(--fs-12);
        color: var(--ink-3);
      }
      .sec {
        font-size: var(--fs-16);
        margin-bottom: var(--sp-1);
      }
      .sec__hint {
        font-size: var(--fs-12);
        color: var(--ink-3);
        margin-bottom: var(--sp-4);
        line-height: 1.5;
      }
      .region-add .input {
        flex: 1;
        min-width: 140px;
      }
      .regions {
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
      }
      .region {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        padding: 5px 6px 5px 10px;
        border: 1px solid var(--border);
        border-radius: var(--radius-control);
      }
      .region__no {
        min-width: 22px;
        height: 22px;
        justify-content: center;
        border-radius: 50%;
        padding: 0;
      }
      .region__name {
        flex: 1;
        font-weight: 700;
        min-width: 0;
        overflow-wrap: anywhere;
      }

      /* 선택 칩: 현재 선택은 잉크 채움(딥 블루는 조작 동선에만 남긴다) */
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--sp-2);
      }
      .pick {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        min-height: 36px;
        padding: 0 var(--sp-3);
        border: 1px solid var(--border);
        border-radius: var(--radius-control);
        font-size: var(--fs-13);
        font-weight: 500;
        color: var(--ink-2);
        background: var(--panel);
        cursor: pointer;
        transition:
          background-color var(--dur) var(--ease-out),
          border-color var(--dur) var(--ease-out),
          color var(--dur) var(--ease-out);
      }
      /* 보이는 상자는 36px, 조작 영역은 44px */
      .pick::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        top: 50%;
        height: 44px;
        transform: translateY(-50%);
      }
      @media (hover: hover) {
        .pick:hover {
          border-color: var(--border-strong);
          color: var(--ink);
        }
      }
      /*
        작은 세그먼트가 여러 개 붙는 자리는 단색 잉크로 채운다.
        그라데이션은 화면당 하나만 선택되는 큰 요소(날짜 칩)에만 쓴다.
      */
      .pick--on {
        background: var(--ink);
        border-color: var(--ink);
        color: #fff;
        font-weight: 700;
      }
      /*
         라디오·체크박스는 시각적으로만 숨기고 조작 영역은 라벨 전체를 덮는다.
         1px + opacity:0으로 줄이면 브라우저·자동화 도구가 '보이지 않는 요소'로
         판단해 클릭을 거부한다. z-index로 ::after 터치 영역보다 위에 둔다.
      */
      .pick input {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        opacity: 0;
        cursor: pointer;
        z-index: 1;
      }
      .pick:has(input:focus-visible) {
        outline: 2px solid var(--accent-deep);
        outline-offset: 2px;
      }

      /* 조건 요약 */
      .sum {
        display: flex;
        flex-direction: column;
      }
      .sum__row {
        display: grid;
        grid-template-columns: 84px minmax(0, 1fr) auto;
        align-items: center;
        gap: var(--sp-2);
        width: 100%;
        min-height: 44px;
        padding: var(--sp-2) 0;
        border: 0;
        border-top: 1px solid var(--border);
        background: none;
        text-align: left;
        color: var(--ink-3);
      }
      .sum li:first-child .sum__row {
        border-top: 0;
      }
      .sum__label {
        font-size: var(--fs-13);
        color: var(--ink-3);
      }
      .sum__value {
        font-size: var(--fs-14);
        color: var(--ink);
        font-weight: 500;
        overflow-wrap: anywhere;
      }

      /* 결과 선택 목록 */
      .picks {
        display: flex;
        flex-direction: column;
      }
      .pickrow {
        border-top: 1px solid var(--border);
      }
      .pickrow:first-child {
        border-top: 0;
      }
      .pickrow__label {
        display: flex;
        align-items: flex-start;
        gap: var(--sp-3);
        padding: var(--sp-3) 0;
        min-height: 44px;
        cursor: pointer;
      }
      .pickrow__label input {
        width: 20px;
        height: 20px;
        margin: 2px 0 0;
        accent-color: var(--accent-deep);
        flex: none;
      }
      .pickrow__main {
        display: flex;
        flex-direction: column;
        gap: var(--sp-1);
        min-width: 0;
      }
      .pickrow__title {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 5px;
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class AiPlanPage {
  readonly store = inject(TripStore);
  private readonly router = inject(Router);
  private readonly pageBar = inject(PageBar);

  readonly companions = COMPANION;
  readonly paces = PACE;
  readonly transports = TRANSPORT;
  readonly sampleItems = SAMPLE_ITEMS;

  readonly phase = signal<Phase>('step1');
  readonly saving = signal(false);

  // 1단계
  readonly regions = signal<string[]>([]);
  readonly regionInput = signal('');
  readonly startDate = signal('');
  readonly endDate = signal('');
  // 2단계 (기본값 있음)
  readonly companion = signal<string>('친구');
  readonly transport = signal<string>('자가용');
  readonly pace = signal<string>('보통');
  readonly taste = signal('');
  // 3단계 (선택)
  readonly mustGo = signal('');
  readonly bookedStay = signal('');
  readonly extraNote = signal('');

  /** 검증된 항목만 기본 선택. 전체 선택은 자동 저장이 아니다. */
  readonly selected = signal<Set<string>>(new Set(SAMPLE_ITEMS.filter((i) => i.verified).map((i) => i.id)));

  readonly stepNumber = computed(() => (this.phase() === 'step1' ? 1 : this.phase() === 'step2' ? 2 : 3));
  readonly dateValidation = computed(() => validateTripDates(this.startDate(), this.endDate()));
  readonly dateError = computed(() => (this.dateValidation().ok ? null : (this.dateValidation() as { message: string }).message));
  readonly canLeaveStep1 = computed(() => this.regions().length > 0 && this.dateValidation().ok);

  readonly summaryRows = computed(() => [
    { label: '지역', value: this.regions().join(' → '), phase: 'step1' as Phase },
    { label: '날짜', value: this.startDate() && this.endDate() ? `${this.startDate()} ~ ${this.endDate()}` : '날짜 미정', phase: 'step1' as Phase },
    { label: '동행', value: this.companion(), phase: 'step2' as Phase },
    { label: '이동수단', value: this.transport(), phase: 'step2' as Phase },
    { label: '일정 밀도', value: this.pace(), phase: 'step2' as Phase },
    { label: '취향', value: this.taste(), phase: 'step2' as Phase },
    { label: '꼭 갈 장소', value: this.mustGo(), phase: 'step3' as Phase },
    { label: '정한 숙소', value: this.bookedStay(), phase: 'step3' as Phase },
    { label: '추가 요청', value: this.extraNote(), phase: 'step3' as Phase },
  ]);

  constructor() {
    this.pageBar.set({ title: 'AI 일정 만들기', back: ['/trips'], action: null });
  }

  addRegion(event?: Event): void {
    event?.preventDefault();
    const name = this.regionInput().trim();
    if (!name) return;
    this.regions.update((list) => [...list, name]);
    this.regionInput.set('');
  }

  removeRegion(index: number): void {
    this.regions.update((list) => list.filter((_, i) => i !== index));
  }

  toggle(id: string): void {
    this.selected.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /**
   * 생성. 실제 AI 호출은 없고 고정 목데이터를 보여줄 뿐이다.
   * 단계 이동·체크 토글에서는 이 함수를 부르지 않는다.
   */
  generate(): void {
    this.phase.set('result');
  }

  leave(event: Event): void {
    event.preventDefault();
    void this.router.navigate(['/trips']);
  }

  /** 선택한 항목만 새 여행에 담는다. 좌표는 미확인으로 남긴다. */
  async commit(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    const regionModels: TripRegion[] = this.regions().map((name, i) => {
      const r = createRegion(name, i);
      return { ...r, order: i };
    });
    let trip: Trip = createTrip({
      title: this.regions().length > 0 ? `${this.regions().join('·')} 여행` : '새 여행',
      startDate: this.startDate() || null,
      endDate: this.endDate() || null,
      regions: regionModels,
    });
    /*
      추천 항목의 N일차를 실제 날짜로 옮긴다. 시작일이 없으면(날짜 미정 초안)
      배치할 날짜가 없으므로 미배치로 남긴다. 여행 기간을 넘어서는 일차도
      임의로 날짜를 만들지 않고 미배치로 둔다.
    */
    const start = trip.startDate;
    const end = trip.endDate;
    const lastDayNumber = start && end ? diffDays(start, end) + 1 : 0;
    for (const item of SAMPLE_ITEMS) {
      if (!this.selected().has(item.id)) continue;
      const date = start && item.day >= 1 && item.day <= lastDayNumber ? addDays(start, item.day - 1) : null;
      trip = appendStop(
        trip,
        createStop({
          name: item.name,
          kind: item.kindLabel === '식사' ? 'meal' : 'place',
          memo: `샘플 결과 · ${item.note}`,
          date,
          // 좌표는 확인되지 않았다. 추정 좌표를 만들지 않는다.
          location: null,
        }),
      );
    }
    const ok = await this.store.commit(trip);
    this.saving.set(false);
    if (ok) void this.router.navigate(['/trips', trip.id]);
  }
}
