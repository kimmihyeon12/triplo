import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TripStore } from '../../data/trip-store';
import { enumerateDays, formatKoreanDate } from '../../domain/dates';
import { appendStop, removeStop, updateStop } from '../../domain/itinerary';
import { createStop, STOP_KIND_DEFAULT_NAME, STOP_KIND_LABEL, type StopKind, type Trip, type TripStop } from '../../domain/model';
import { IconComponent } from '../../shared/icon';
import { PlaceSearchBoxComponent } from '../../shared/place-search-box';
import { SaveStatusComponent } from '../../shared/save-status';
import { applyPlaceCandidate, clearLocation, type PlaceCandidate } from '../../domain/location';
import type { GeoPoint, PlaceRef } from '../../domain/model';

@Component({
  selector: 'app-stop-form-page',
  imports: [FormsModule, RouterLink, IconComponent, SaveStatusComponent, PlaceSearchBoxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <header class="row head">
        <a class="btn btn--icon" [routerLink]="backLink()" [queryParams]="backQuery()" aria-label="뒤로"><app-icon name="back" /></a>
        <h1>{{ isEdit() ? '장소·활동 편집' : '장소·활동 추가' }}</h1>
      </header>

      @if (!trip()) {
        <p class="muted" role="status">불러오는 중…</p>
      } @else {
        <form class="panel stack" (submit)="save($event)" novalidate>
          <div class="field">
            <span class="field__label" id="kind-label">종류</span>
            <div class="kinds" role="radiogroup" aria-labelledby="kind-label">
              @for (k of kinds; track k) {
                <label class="kind" [class.kind--on]="kind() === k">
                  <input type="radio" name="kind" [value]="k" [checked]="kind() === k" (change)="setKind(k)" />
                  <app-icon [name]="k" [size]="16" />
                  <span>{{ kindLabel[k] }}</span>
                </label>
              }
            </div>
          </div>

          <div class="field">
            <span class="field__label">장소 검색으로 위치 확인</span>
            <app-place-search-box inputId="stop-place-query" [initialQuery]="kind() === 'place' ? name() : ''" (picked)="onPicked($event)" />
            @if (location()) {
              <div class="row" data-testid="stop-location-verified">
                <span class="cell cell--ok"><app-icon name="pin" [size]="14" /> 위치 확인됨 · {{ providerLabel() }}</span>
                <span class="small muted">{{ location()!.lat.toFixed(5) }}, {{ location()!.lng.toFixed(5) }}</span>
                <button type="button" class="btn btn--ghost btn--sm" (click)="removeLocation()" data-testid="stop-location-clear">위치 지우기</button>
              </div>
            }
          </div>

          <div class="field">
            <label class="field__label" for="name">{{ kind() === 'place' ? '장소 이름' : '이름' }}</label>
            <input id="name" class="input" [ngModel]="name()" (ngModelChange)="name.set($event)" name="name" [placeholder]="kind() === 'place' ? '예: 안목해변' : kindDefault[kind()]" maxlength="80" (blur)="nameTouched.set(true)" [attr.aria-invalid]="nameError() && nameTouched() ? 'true' : null" data-testid="stop-name" />
            @if (nameError() && nameTouched()) {
              <p class="field__error" role="alert">{{ nameError() }}</p>
            }
          </div>

          <div class="field">
            <label class="field__label" for="address">주소 <span class="muted small">(선택)</span></label>
            <input id="address" class="input" [ngModel]="address()" (ngModelChange)="address.set($event)" name="address" placeholder="지도 검색과 주소 복사에 사용" maxlength="200" data-testid="stop-address" />
            @if (!location()) {
              <span class="field__hint"><app-icon name="alert" [size]="12" /> 검색으로 고르지 않은 항목은 ‘위치 미확인’으로 저장됩니다.</span>
            }
          </div>

          <div class="field-row">
            @if (trip()!.regions.length > 0) {
              <div class="field">
                <label class="field__label" for="region">지역</label>
                <select id="region" class="select" [ngModel]="regionId()" (ngModelChange)="regionId.set($event)" name="region" data-testid="stop-region">
                  <option value="">지역 없음</option>
                  @for (r of trip()!.regions; track r.id) {
                    <option [value]="r.id">{{ r.name }}</option>
                  }
                </select>
              </div>
            } @else {
              <div class="field">
                <span class="field__label">지역</span>
                <span class="field__hint">여행 편집에서 지역을 추가할 수 있습니다.</span>
              </div>
            }
            <div class="field">
              <label class="field__label" for="date">날짜</label>
              <select id="date" class="select" [ngModel]="date()" (ngModelChange)="date.set($event)" name="date" data-testid="stop-date">
                <option value="">미배치</option>
                @for (d of days(); track d.date) {
                  <option [value]="d.date">{{ d.label }}</option>
                }
              </select>
              @if (days().length === 0) {
                <span class="field__hint">여행 날짜를 정하면 날짜에 배치할 수 있습니다.</span>
              }
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label class="field__label" for="stay">체류시간(분) <span class="muted small">(선택)</span></label>
              <input id="stay" class="input" type="number" inputmode="numeric" min="0" step="5" [ngModel]="stayMinutes()" (ngModelChange)="stayMinutes.set($event)" name="stayMinutes" placeholder="예: 60" [attr.aria-invalid]="stayError() ? 'true' : null" data-testid="stop-stay" />
              @if (stayError()) {
                <p class="field__error" role="alert">{{ stayError() }}</p>
              }
            </div>
            <div class="field">
              <label class="field__label" for="fixed">고정 시각 <span class="muted small">(예약 등, 선택)</span></label>
              <input id="fixed" class="input" type="time" [ngModel]="fixedTime()" (ngModelChange)="fixedTime.set($event)" name="fixedTime" data-testid="stop-fixed" />
            </div>
          </div>

          <div class="field">
            <label class="field__label" for="memo">메모 <span class="muted small">(선택)</span></label>
            <textarea id="memo" class="textarea" [ngModel]="memo()" (ngModelChange)="memo.set($event)" name="memo" maxlength="500" data-testid="stop-memo"></textarea>
          </div>

          @if (store.saveState() === 'error') {
            <div class="notice notice--danger" role="alert">
              <app-icon name="alert" />
              <div class="notice__body"><strong>저장에 실패했습니다.</strong> 입력한 내용은 그대로 남아 있습니다.<div class="small">{{ store.saveError() }}</div></div>
            </div>
          }

          <div class="row form-actions">
            <button type="submit" class="btn btn--primary" [disabled]="!canSave()" data-testid="stop-save">
              <app-icon name="save" [size]="16" /> {{ store.saveState() === 'error' ? '다시 저장' : '저장' }}
            </button>
            <a class="btn btn--ghost" [routerLink]="backLink()" [queryParams]="backQuery()">취소</a>
            <span class="grow"></span>
            <app-save-status />
          </div>
        </form>

        @if (isEdit()) {
          <section class="panel danger">
            @if (!confirmDelete()) {
              <div class="row">
                <div class="grow">
                  <strong>이 항목 삭제</strong>
                  <p class="small muted">일정에서만 빼려면 날짜별 보기의 ‘제외’를 사용하세요.</p>
                </div>
                <button type="button" class="btn btn--danger btn--sm" (click)="confirmDelete.set(true)" data-testid="stop-delete"><app-icon name="trash" [size]="14" /> 삭제</button>
              </div>
            } @else {
              <div class="row">
                <strong class="grow">정말 삭제할까요? 되돌릴 수 없습니다.</strong>
                <button type="button" class="btn btn--danger btn--sm" (click)="remove()" data-testid="stop-delete-confirm">삭제 확인</button>
                <button type="button" class="btn btn--ghost btn--sm" (click)="confirmDelete.set(false)">취소</button>
              </div>
            }
          </section>
        }
      }
    </div>
  `,
  styles: [
    `
      .head {
        gap: var(--sp-3);
      }
      .kinds {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 6px;
      }
      @media (max-width: 420px) {
        .kinds {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      .kind {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-height: 44px;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-control);
        font-weight: 500;
        font-size: var(--fs-14);
        cursor: pointer;
        background: var(--panel);
        color: var(--ink-2);
        transition:
          background-color var(--dur) var(--ease-out),
          border-color var(--dur) var(--ease-out),
          color var(--dur) var(--ease-out);
      }
      .kind:hover {
        border-color: var(--ink-3);
        color: var(--ink);
      }
      .kind--on {
        background: var(--ink);
        border-color: var(--ink);
        color: #fff;
        font-weight: 700;
      }
      .kind input {
        position: absolute;
        opacity: 0;
        width: 1px;
        height: 1px;
      }
      .kind:has(input:focus-visible) {
        outline: 2px solid var(--accent-deep);
        outline-offset: 2px;
      }
      .form-actions {
        gap: var(--sp-2);
      }
      .grow {
        flex: 1;
        min-width: 0;
      }
      .danger {
        border-color: color-mix(in srgb, var(--danger-ink) 35%, transparent);
      }
      .field__hint app-icon {
        vertical-align: -2px;
        color: var(--warn-ink);
      }
    `,
  ],
})
export class StopFormPage {
  readonly id = input.required<string>();
  readonly stopId = input<string | undefined>();
  /** 새 항목의 기본 종류·날짜(쿼리) */
  readonly kindParam = input<string | undefined>(undefined, { alias: 'kind' });
  readonly dateParam = input<string | undefined>(undefined, { alias: 'date' });

  readonly store = inject(TripStore);
  private readonly router = inject(Router);

  readonly kinds: StopKind[] = ['place', 'meal', 'break', 'buffer'];
  readonly kindLabel = STOP_KIND_LABEL;
  readonly kindDefault = STOP_KIND_DEFAULT_NAME;

  readonly trip = signal<Trip | null>(null);
  readonly editing = signal<TripStop | null>(null);
  readonly isEdit = computed(() => !!this.stopId());

  readonly kind = signal<StopKind>('place');
  readonly name = signal('');
  readonly address = signal('');
  readonly regionId = signal('');
  readonly date = signal('');
  readonly stayMinutes = signal<number | string | null>(null);
  readonly fixedTime = signal('');
  readonly memo = signal('');
  readonly confirmDelete = signal(false);
  readonly nameTouched = signal(false);
  readonly location = signal<GeoPoint | null>(null);
  readonly placeRef = signal<PlaceRef | null>(null);
  readonly providerLabel = computed(() => (this.placeRef()?.provider === 'kakao' ? '카카오' : this.placeRef()?.provider === 'fixture' ? '테스트 픽스처' : ''));

  readonly days = computed(() => {
    const t = this.trip();
    if (!t?.startDate || !t.endDate) return [];
    return enumerateDays(t.startDate, t.endDate).map((d, i) => ({ date: d, label: `${i + 1}일차 · ${formatKoreanDate(d)}` }));
  });

  readonly nameError = computed(() => (this.kind() === 'place' && !this.name().trim() ? '장소 이름을 입력하세요.' : null));
  readonly stayError = computed(() => {
    const v = this.stayMinutes();
    if (v === null || v === '' || v === undefined) return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 ? null : '0 이상의 분 단위로 입력하세요.';
  });
  readonly canSave = computed(() => !this.nameError() && !this.stayError() && this.store.saveState() !== 'saving');

  readonly backLink = computed(() => ['/trips', this.id()]);
  readonly backQuery = computed(() => (this.date() ? { tab: 'days', day: this.date() } : { tab: 'overview' }));

  constructor() {
    effect(() => {
      const id = this.id();
      const stopId = this.stopId();
      void this.store.open(id).then((trip) => {
        this.trip.set(trip);
        if (!trip) return;
        const stop = stopId ? trip.stops.find((s) => s.id === stopId) ?? null : null;
        this.editing.set(stop);
        if (stop) {
          this.kind.set(stop.kind);
          this.name.set(stop.name);
          this.address.set(stop.address);
          this.regionId.set(stop.regionId ?? '');
          this.date.set(stop.date ?? '');
          this.stayMinutes.set(stop.stayMinutes);
          this.fixedTime.set(stop.fixedTime ?? '');
          this.memo.set(stop.memo);
          this.location.set(stop.location ?? null);
          this.placeRef.set(stop.placeRef ?? null);
        } else {
          const k = this.kindParam();
          if (k && (this.kinds as string[]).includes(k)) this.setKind(k as StopKind);
          const d = this.dateParam();
          if (d && trip.startDate && trip.endDate && enumerateDays(trip.startDate, trip.endDate).includes(d)) this.date.set(d);
        }
      });
    });
  }

  onPicked(candidate: PlaceCandidate): void {
    const applied = applyPlaceCandidate(createStop({ name: this.name(), address: this.address() }), candidate);
    this.name.set(applied.name);
    this.address.set(applied.address);
    this.location.set(applied.location);
    this.placeRef.set(applied.placeRef);
    this.nameTouched.set(true);
  }

  removeLocation(): void {
    const cleared = clearLocation(createStop({ name: this.name(), address: this.address(), location: this.location(), placeRef: this.placeRef() }));
    this.location.set(cleared.location);
    this.placeRef.set(cleared.placeRef);
  }

  setKind(k: StopKind): void {
    const prevDefault = STOP_KIND_DEFAULT_NAME[this.kind()];
    this.kind.set(k);
    if (!this.name().trim() || this.name() === prevDefault) this.name.set(STOP_KIND_DEFAULT_NAME[k]);
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();
    const trip = this.trip();
    if (!trip || !this.canSave()) return;
    const raw = this.stayMinutes();
    const stayMinutes = raw === null || raw === '' ? null : Number(raw);
    const base = this.editing();
    const stop = createStop({
      ...(base ?? {}),
      id: base?.id,
      kind: this.kind(),
      name: this.name(),
      address: this.address().trim(),
      regionId: this.regionId() || null,
      date: this.date() || null,
      stayMinutes,
      fixedTime: this.fixedTime() || null,
      memo: this.memo().trim(),
      excluded: base?.excluded ?? false,
      location: this.location(),
      placeRef: this.placeRef(),
    });
    const next = base ? updateStop(trip, stop) : appendStop(trip, stop);
    const ok = await this.store.commit(next);
    if (ok) void this.router.navigate(this.backLink(), { queryParams: this.backQuery() });
  }

  async remove(): Promise<void> {
    const trip = this.trip();
    const base = this.editing();
    if (!trip || !base) return;
    const ok = await this.store.commit(removeStop(trip, base.id));
    if (ok) void this.router.navigate(this.backLink(), { queryParams: this.backQuery() });
  }
}
