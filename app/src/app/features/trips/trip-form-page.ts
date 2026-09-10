import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TripStore } from '../../data/trip-store';
import { formatNights, validateTripDates } from '../../domain/dates';
import { createRegion, createTrip, type Trip, type TripRegion } from '../../domain/model';
import { applyPeriodChange, periodChangeImpact, regionRemovalImpact, removeRegion } from '../../domain/period';
import { IconComponent } from '../../shared/icon';
import { PageBar } from '../../shared/page-bar';
import { SaveStatusComponent } from '../../shared/save-status';

interface RegionDraft {
  id: string;
  name: string;
  isNew: boolean;
}

@Component({
  selector: 'app-trip-form-page',
  imports: [FormsModule, RouterLink, IconComponent, SaveStatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      @if (isEdit() && store.currentState() === 'loading') {
        <p class="muted" role="status">불러오는 중…</p>
      } @else if (isEdit() && !original()) {
        <div class="notice notice--danger" role="alert">
          <app-icon name="alert" />
          <div class="notice__body"><strong>여행을 찾을 수 없습니다.</strong>
            <div class="notice__actions"><a routerLink="/trips" class="btn btn--sm">목록으로</a></div>
          </div>
        </div>
      } @else {
        <form class="panel stack" (submit)="save($event)" novalidate>
          <div class="field">
            <label class="field__label" for="title">여행 이름</label>
            <input id="title" class="input" [ngModel]="title()" (ngModelChange)="title.set($event)" name="title" placeholder="새 여행" maxlength="60" data-testid="trip-title" />
            <span class="field__hint">비워 두면 ‘새 여행’으로 저장됩니다.</span>
          </div>

          <fieldset class="dates">
            <legend class="field__label">여행 기간</legend>
            <div class="field-row">
              <div class="field">
                <label class="field__label small" for="start">시작일</label>
                <input id="start" type="date" class="input" [ngModel]="startDate()" (ngModelChange)="startDate.set($event)" name="start" [attr.aria-invalid]="dateError() ? 'true' : null" data-testid="trip-start" />
              </div>
              <div class="field">
                <label class="field__label small" for="end">종료일</label>
                <input id="end" type="date" class="input" [ngModel]="endDate()" (ngModelChange)="endDate.set($event)" name="end" [attr.aria-invalid]="dateError() ? 'true' : null" data-testid="trip-end" />
              </div>
            </div>
            @if (dateError()) {
              <p class="field__error" role="alert" data-testid="date-error">{{ dateError() }}</p>
            } @else if (nightsText()) {
              <p class="cell cell--accent" data-testid="nights">{{ nightsText() }}</p>
            } @else {
              <p class="field__hint">날짜를 비워 두면 ‘날짜 미정’ 초안으로 저장됩니다.</p>
            }
          </fieldset>

          <fieldset>
            <legend class="field__label">지역 (순서대로)</legend>
            <div class="row region-add">
              <label class="visually-hidden" for="region-name">지역 이름</label>
              <input id="region-name" class="input" [ngModel]="regionInput()" (ngModelChange)="regionInput.set($event)" name="regionName" placeholder="예: 강릉" maxlength="30" (keydown.enter)="addRegion($event)" data-testid="region-input" />
              <button type="button" class="btn" (click)="addRegion()" data-testid="region-add">추가</button>
            </div>
            @if (regions().length === 0) {
              <p class="field__hint">지역은 선택 사항입니다. 하루에 두 지역을 다닐 수도 있습니다.</p>
            } @else {
              <ol class="regions" data-testid="region-list">
                @for (r of regions(); track r.id; let i = $index; let first = $first; let last = $last) {
                  <li class="region">
                    <span class="cell cell--solid-accent region__no">{{ i + 1 }}</span>
                    <span class="region__name">{{ r.name }}</span>
                    <span class="row region__actions">
                      <button type="button" class="btn btn--icon" [disabled]="first" (click)="moveRegion(i, -1)" [attr.aria-label]="r.name + ' 위로'"><app-icon name="arrow-up" [size]="16" /></button>
                      <button type="button" class="btn btn--icon" [disabled]="last" (click)="moveRegion(i, 1)" [attr.aria-label]="r.name + ' 아래로'"><app-icon name="arrow-down" [size]="16" /></button>
                      <button type="button" class="btn btn--icon" (click)="removeRegionDraft(i)" [attr.aria-label]="r.name + ' 삭제'"><app-icon name="x" [size]="16" /></button>
                    </span>
                  </li>
                }
              </ol>
            }
          </fieldset>

          @if (impactLines().length > 0) {
            <div class="notice notice--warn" data-testid="impact-box">
              <app-icon name="alert" />
              <div class="notice__body">
                <strong>저장하면 아래 영향이 생깁니다. 어떤 항목도 삭제되지 않습니다.</strong>
                <ul class="impact-list">
                  @for (line of impactLines(); track line) {
                    <li>{{ line }}</li>
                  }
                </ul>
                <label class="check" style="margin-top:8px">
                  <input type="checkbox" [ngModel]="impactConfirmed()" (ngModelChange)="impactConfirmed.set($event)" name="impactConfirmed" data-testid="impact-confirm" />
                  <span>영향을 확인했습니다</span>
                </label>
              </div>
            </div>
          }

          @if (store.saveState() === 'error') {
            <div class="notice notice--danger" role="alert">
              <app-icon name="alert" />
              <div class="notice__body">
                <strong>저장에 실패했습니다.</strong> 입력한 내용은 그대로 남아 있습니다.
                <div class="small">{{ store.saveError() }}</div>
              </div>
            </div>
          }

          @if (store.saveState() !== 'idle') {
            <div class="row form-status"><app-save-status /></div>
          }

          <!-- 저장·취소는 하단 고정 바에 둔다(모바일에서 스크롤 없이 닿게) -->
          <div class="action-bar">
            <div class="action-bar__inner">
              <a class="btn" [routerLink]="backLink()">취소</a>
              <button type="submit" class="btn btn--primary" [disabled]="!canSave()" data-testid="trip-save">
                {{ store.saveState() === 'error' ? '다시 저장' : '저장' }}
              </button>
            </div>
          </div>
        </form>
      }
    </div>
  `,
  styles: [
    `
      fieldset {
        border: 0;
        padding: 0;
        margin: 0 0 14px;
        min-width: 0;
      }
      legend {
        padding: 0;
        margin-bottom: 5px;
      }
      .region-add .input {
        flex: 1;
        min-width: 140px;
      }
      .regions {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 8px;
      }
      .region {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 6px 5px 10px;
        border: 1px solid var(--border);
        border-radius: var(--radius-control);
        background: var(--panel);
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
      .region__actions {
        gap: 4px;
        flex: none;
      }
      .impact-list {
        margin-top: 6px;
        padding-left: 18px;
        list-style: disc;
      }
      .form-status {
        justify-content: flex-end;
      }
      .grow {
        flex: 1;
      }
    `,
  ],
})
export class TripFormPage {
  readonly id = input<string | undefined>();
  readonly store = inject(TripStore);
  private readonly router = inject(Router);
  private readonly pageBar = inject(PageBar);

  readonly isEdit = computed(() => !!this.id());
  readonly original = signal<Trip | null>(null);

  readonly title = signal('');
  readonly startDate = signal('');
  readonly endDate = signal('');
  readonly regions = signal<RegionDraft[]>([]);
  readonly regionInput = signal('');
  readonly impactConfirmed = signal(false);

  readonly dateValidation = computed(() => validateTripDates(this.startDate(), this.endDate()));
  readonly dateError = computed(() => (this.dateValidation().ok ? null : (this.dateValidation() as { message: string }).message));
  readonly nightsText = computed(() => {
    const v = this.dateValidation();
    return v.ok && !v.undecided ? formatNights(this.startDate(), this.endDate()) : '';
  });

  readonly backLink = computed(() => (this.id() ? ['/trips', this.id()!] : ['/trips']));

  /** 편집 시 기간 변경·지역 삭제 영향 설명 */
  readonly impactLines = computed(() => {
    const orig = this.original();
    if (!orig || !this.dateValidation().ok) return [];
    const lines: string[] = [];
    const start = this.startDate() || null;
    const end = this.endDate() || null;
    const impact = periodChangeImpact(orig, start, end);
    if (impact.displacedStops.length > 0) {
      lines.push(`장소 ${impact.displacedStops.length}개가 새 기간 밖에 있어 미배치로 이동합니다: ${impact.displacedStops.map((s) => s.name).join(', ')}`);
    }
    if (impact.outOfRangeStays.length > 0) {
      lines.push(`숙소 ${impact.outOfRangeStays.length}개가 여행 기간 밖이 됩니다(보존됨): ${impact.outOfRangeStays.map((s) => s.name).join(', ')}`);
    }
    const keptIds = new Set(this.regions().map((r) => r.id));
    for (const r of orig.regions) {
      if (keptIds.has(r.id)) continue;
      const ri = regionRemovalImpact(orig, r.id);
      if (ri.stopCount + ri.stayCount > 0) {
        lines.push(`지역 ‘${r.name}’ 삭제: 장소 ${ri.stopCount}개·숙소 ${ri.stayCount}개의 지역 표시가 해제됩니다(항목은 보존)`);
      }
    }
    return lines;
  });

  readonly canSave = computed(() => this.dateValidation().ok && (this.impactLines().length === 0 || this.impactConfirmed()) && this.store.saveState() !== 'saving');

  constructor() {
    // 상단 바: ‹ 뒤로 + 화면 제목. 저장은 하단 고정 바에 둔다.
    effect(() => {
      this.pageBar.set({ title: this.isEdit() ? '여행 편집' : '여행 만들기', back: this.backLink(), action: null });
    });
    effect(() => {
      const id = this.id();
      if (!id) {
        this.original.set(null);
        return;
      }
      void this.store.open(id).then((trip) => {
        this.original.set(trip);
        if (trip) {
          this.title.set(trip.title);
          this.startDate.set(trip.startDate ?? '');
          this.endDate.set(trip.endDate ?? '');
          this.regions.set(trip.regions.map((r) => ({ id: r.id, name: r.name, isNew: false })));
        }
      });
    });
  }

  addRegion(event?: Event): void {
    event?.preventDefault();
    const name = this.regionInput().trim();
    if (!name) return;
    this.regions.update((list) => [...list, { id: createRegion(name, list.length).id, name, isNew: true }]);
    this.regionInput.set('');
  }

  moveRegion(index: number, delta: number): void {
    this.regions.update((list) => {
      const next = [...list];
      const target = index + delta;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  removeRegionDraft(index: number): void {
    this.regions.update((list) => list.filter((_, i) => i !== index));
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canSave()) return;
    const start = this.startDate() || null;
    const end = this.endDate() || null;
    const regions: TripRegion[] = this.regions().map((r, i) => ({ id: r.id, name: r.name, order: i }));
    let next: Trip;
    const orig = this.original();
    if (orig) {
      next = applyPeriodChange(orig, start, end);
      const keptIds = new Set(regions.map((r) => r.id));
      for (const r of orig.regions) if (!keptIds.has(r.id)) next = removeRegion(next, r.id);
      next = { ...next, title: this.title().trim() || '새 여행', regions };
    } else {
      next = createTrip({ title: this.title(), startDate: start, endDate: end, regions });
    }
    const ok = await this.store.commit(next);
    if (ok) void this.router.navigate(['/trips', next.id]);
  }
}
