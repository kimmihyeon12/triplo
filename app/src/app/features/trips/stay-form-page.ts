import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TripStore } from '../../data/trip-store';
import { addDays, formatPeriod } from '../../domain/dates';
import { createStay, RESERVATION_LABEL, type AccommodationStay, type ReservationState, type Trip } from '../../domain/model';
import { nightCoverage, stayNightCount, stayWarnings, validateStayDates } from '../../domain/stays';
import { IconComponent } from '../../shared/icon';
import { PageBar } from '../../shared/page-bar';
import { PlaceSearchBoxComponent } from '../../shared/place-search-box';
import { SaveStatusComponent } from '../../shared/save-status';
import { applyPlaceCandidate, clearLocation, type PlaceCandidate } from '../../domain/location';
import type { GeoPoint, PlaceRef } from '../../domain/model';

@Component({
  selector: 'app-stay-form-page',
  imports: [FormsModule, RouterLink, IconComponent, SaveStatusComponent, PlaceSearchBoxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      @if (!trip()) {
        <p class="muted" role="status">불러오는 중…</p>
      } @else {
        <p class="row small muted">
          <app-icon name="calendar" [size]="14" /> 여행 기간: {{ period() }}
        </p>
        <form class="panel stack" (submit)="save($event)" novalidate>
          <div class="field">
            <span class="field__label">숙소 검색으로 위치 확인</span>
            <app-place-search-box inputId="stay-place-query" placeholder="예: 강릉 호텔, 속초 게스트하우스" [initialQuery]="name()" (picked)="onPicked($event)" />
            @if (location()) {
              <div class="row" data-testid="stay-location-verified">
                <span class="cell cell--ok"><app-icon name="pin" [size]="14" /> 위치 확인됨 · {{ providerLabel() }}</span>
                <span class="small muted">{{ location()!.lat.toFixed(5) }}, {{ location()!.lng.toFixed(5) }}</span>
                <button type="button" class="btn btn--ghost btn--sm" (click)="removeLocation()" data-testid="stay-location-clear">위치 지우기</button>
              </div>
            }
          </div>

          <div class="field">
            <label class="field__label" for="name">숙소 이름</label>
            <input id="name" class="input" [ngModel]="name()" (ngModelChange)="name.set($event)" name="name" placeholder="예: 강릉 A 호텔, 친구 집" maxlength="80" (blur)="nameTouched.set(true)" [attr.aria-invalid]="nameError() && nameTouched() ? 'true' : null" data-testid="stay-name" />
            @if (nameError() && nameTouched()) {
              <p class="field__error" role="alert">{{ nameError() }}</p>
            }
          </div>

          <div class="field">
            <label class="field__label" for="address">주소 <span class="muted small">(선택)</span></label>
            <input id="address" class="input" [ngModel]="address()" (ngModelChange)="address.set($event)" name="address" maxlength="200" data-testid="stay-address" />
            @if (!location()) {
              <span class="field__hint"><app-icon name="alert" [size]="12" /> 검색으로 고르지 않은 숙소는 ‘위치 미확인’으로 저장되며 경로 계산 전 위치 확인이 필요합니다.</span>
            }
          </div>

          @if (trip()!.regions.length > 0) {
            <div class="field">
              <label class="field__label" for="region">지역 <span class="muted small">(선택)</span></label>
              <select id="region" class="select" [ngModel]="regionId()" (ngModelChange)="regionId.set($event)" name="region" data-testid="stay-region">
                <option value="">지역 없음</option>
                @for (r of trip()!.regions; track r.id) {
                  <option [value]="r.id">{{ r.name }}</option>
                }
              </select>
            </div>
          }

          <fieldset>
            <legend class="field__label">숙박 날짜</legend>
            <div class="field-row">
              <div class="field">
                <label class="field__label small" for="checkin">체크인</label>
                <input id="checkin" type="date" class="input" [ngModel]="checkIn()" (ngModelChange)="checkIn.set($event)" name="checkIn" (blur)="datesTouched.set(true)" [attr.aria-invalid]="showDateError() ? 'true' : null" data-testid="stay-checkin" />
              </div>
              <div class="field">
                <label class="field__label small" for="checkout">체크아웃</label>
                <input id="checkout" type="date" class="input" [ngModel]="checkOut()" (ngModelChange)="checkOut.set($event)" name="checkOut" (blur)="datesTouched.set(true)" [attr.aria-invalid]="showDateError() ? 'true' : null" data-testid="stay-checkout" />
              </div>
            </div>
            @if (showDateError()) {
              <p class="field__error" role="alert" data-testid="stay-date-error">{{ dateError() }}</p>
            } @else if (!dateError()) {
              <p class="cell cell--stay" data-testid="stay-nights">{{ nightsText() }}</p>
            } @else {
              <p class="field__hint">체크인 날짜와 체크아웃 날짜를 입력하면 몇 박인지 표시됩니다.</p>
            }
          </fieldset>

          <div class="field-row">
            <div class="field">
              <label class="field__label small" for="checkin-time">체크인 시각 <span class="muted">(미정 가능)</span></label>
              <input id="checkin-time" type="time" class="input" [ngModel]="checkInTime()" (ngModelChange)="checkInTime.set($event)" name="checkInTime" data-testid="stay-checkin-time" />
            </div>
            <div class="field">
              <label class="field__label small" for="checkout-time">체크아웃 시각 <span class="muted">(미정 가능)</span></label>
              <input id="checkout-time" type="time" class="input" [ngModel]="checkOutTime()" (ngModelChange)="checkOutTime.set($event)" name="checkOutTime" data-testid="stay-checkout-time" />
            </div>
          </div>

          <div class="field">
            <label class="field__label" for="reservation">예약 여부 <span class="muted small">(사용자 입력, 실시간 확인 아님)</span></label>
            <select id="reservation" class="select" [ngModel]="reservation()" (ngModelChange)="reservation.set($event)" name="reservation" data-testid="stay-reservation">
              @for (r of reservationStates; track r) {
                <option [value]="r">{{ reservationLabel[r] }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label class="field__label" for="memo">메모 <span class="muted small">(선택, 비공개)</span></label>
            <textarea id="memo" class="textarea" [ngModel]="memo()" (ngModelChange)="memo.set($event)" name="memo" maxlength="500" data-testid="stay-memo"></textarea>
          </div>

          @if (undecidedTrip()) {
            <div class="notice notice--warn">
              <app-icon name="alert" />
              <div class="notice__body">여행 날짜가 미정입니다. 여행 날짜를 정한 뒤 이 숙박이 기간 안에 있는지 다시 확인됩니다.</div>
            </div>
          }

          @if (warnings().length > 0) {
            <div class="notice notice--warn" data-testid="stay-warnings">
              <app-icon name="alert" />
              <div class="notice__body">
                <strong>확인이 필요합니다</strong>
                <ul class="warn-list">
                  @for (w of warnings(); track w) {
                    <li>{{ w }}</li>
                  }
                </ul>
                <label class="check" style="margin-top:8px">
                  <input type="checkbox" [ngModel]="warningsConfirmed()" (ngModelChange)="warningsConfirmed.set($event)" name="warningsConfirmed" data-testid="stay-warning-confirm" />
                  <span>확인하고 저장합니다</span>
                </label>
              </div>
            </div>
          }

          @if (store.saveState() === 'error') {
            <div class="notice notice--danger" role="alert">
              <app-icon name="alert" />
              <div class="notice__body"><strong>저장에 실패했습니다.</strong> 입력한 내용은 그대로 남아 있습니다.<div class="small">{{ store.saveError() }}</div></div>
            </div>
          }

          @if (store.saveState() !== 'idle') {
            <div class="row form-status"><app-save-status /></div>
          }

          <!-- 저장·취소는 하단 고정 바에 둔다(모바일에서 스크롤 없이 닿게) -->
          <div class="action-bar">
            <div class="action-bar__inner">
              <a class="btn" [routerLink]="backLink()" [queryParams]="{ tab: 'stays' }">취소</a>
              <button type="submit" class="btn btn--primary" [disabled]="!canSave()" data-testid="stay-save">
                {{ store.saveState() === 'error' ? '다시 저장' : '저장' }}
              </button>
            </div>
          </div>
        </form>

        @if (isEdit()) {
          <section class="panel danger">
            @if (!confirmDelete()) {
              <div class="row">
                <strong class="grow">이 숙박 삭제</strong>
                <button type="button" class="btn btn--danger btn--sm" (click)="confirmDelete.set(true)" data-testid="stay-delete"><app-icon name="trash" [size]="14" /> 삭제</button>
              </div>
            } @else {
              <div class="row">
                <strong class="grow">정말 삭제할까요? 되돌릴 수 없습니다.</strong>
                <button type="button" class="btn btn--danger btn--sm" (click)="remove()" data-testid="stay-delete-confirm">삭제 확인</button>
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
      .warn-list {
        margin-top: 6px;
        padding-left: 18px;
        list-style: disc;
      }
      .form-status {
        justify-content: flex-end;
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
export class StayFormPage {
  readonly id = input.required<string>();
  readonly stayId = input<string | undefined>();
  readonly store = inject(TripStore);
  private readonly router = inject(Router);
  private readonly pageBar = inject(PageBar);

  readonly reservationStates: ReservationState[] = ['unknown', 'reserved', 'not_reserved'];
  readonly reservationLabel = RESERVATION_LABEL;

  readonly trip = signal<Trip | null>(null);
  readonly editing = signal<AccommodationStay | null>(null);
  readonly isEdit = computed(() => !!this.stayId());

  readonly name = signal('');
  readonly address = signal('');
  readonly regionId = signal('');
  readonly checkIn = signal('');
  readonly checkOut = signal('');
  readonly checkInTime = signal('');
  readonly checkOutTime = signal('');
  readonly reservation = signal<ReservationState>('unknown');
  readonly memo = signal('');
  readonly warningsConfirmed = signal(false);
  readonly confirmDelete = signal(false);
  readonly nameTouched = signal(false);
  readonly datesTouched = signal(false);
  readonly location = signal<GeoPoint | null>(null);
  readonly placeRef = signal<PlaceRef | null>(null);
  readonly providerLabel = computed(() => (this.placeRef()?.provider === 'kakao' ? '카카오' : this.placeRef()?.provider === 'fixture' ? '테스트 픽스처' : ''));
  /** 두 날짜를 모두 입력했거나 필드를 떠난 뒤에만 날짜 오류를 보여준다. */
  readonly showDateError = computed(() => !!this.dateError() && (this.datesTouched() || (!!this.checkIn() && !!this.checkOut())));

  readonly period = computed(() => {
    const t = this.trip();
    return t ? formatPeriod(t.startDate, t.endDate) : '';
  });
  readonly undecidedTrip = computed(() => {
    const t = this.trip();
    return !!t && (!t.startDate || !t.endDate);
  });
  readonly nameError = computed(() => (this.name().trim() ? null : '숙소 이름을 입력하세요.'));
  readonly dateValidation = computed(() => validateStayDates(this.checkIn(), this.checkOut()));
  readonly dateError = computed(() => (this.dateValidation().ok ? null : (this.dateValidation() as { message: string }).message));
  readonly nightsText = computed(() => (this.dateValidation().ok ? `${stayNightCount({ checkIn: this.checkIn(), checkOut: this.checkOut() })}박` : ''));
  readonly warnings = computed(() => {
    const t = this.trip();
    if (!t || !this.dateValidation().ok) return [];
    return stayWarnings(t, { id: this.editing()?.id ?? '__new__', checkIn: this.checkIn(), checkOut: this.checkOut() });
  });
  readonly canSave = computed(
    () => !this.nameError() && this.dateValidation().ok && (this.warnings().length === 0 || this.warningsConfirmed()) && this.store.saveState() !== 'saving',
  );
  readonly backLink = computed(() => ['/trips', this.id()]);

  constructor() {
    // 상단 바: ‹ 뒤로 + 화면 제목. 저장은 하단 고정 바에 둔다.
    effect(() => {
      this.pageBar.set({
        title: this.isEdit() ? '숙소 편집' : '숙소 추가',
        back: this.backLink(),
        backQueryParams: { tab: 'stays' },
        action: null,
      });
    });
    effect(() => {
      const id = this.id();
      const stayId = this.stayId();
      void this.store.open(id).then((trip) => {
        this.trip.set(trip);
        if (!trip) return;
        const stay = stayId ? trip.stays.find((s) => s.id === stayId) ?? null : null;
        this.editing.set(stay);
        if (stay) {
          this.name.set(stay.name);
          this.address.set(stay.address);
          this.regionId.set(stay.regionId ?? '');
          this.checkIn.set(stay.checkIn);
          this.checkOut.set(stay.checkOut);
          this.checkInTime.set(stay.checkInTime ?? '');
          this.checkOutTime.set(stay.checkOutTime ?? '');
          this.reservation.set(stay.reservation);
          this.memo.set(stay.memo);
          this.location.set(stay.location ?? null);
          this.placeRef.set(stay.placeRef ?? null);
        } else if (trip.startDate && trip.endDate && trip.startDate !== trip.endDate && !this.checkIn()) {
          // 기본값 제안: 아직 숙소가 없는 첫 밤부터 1박. 모든 밤에 숙소가 있으면 비워 둔다. 사용자가 바꿀 수 있다.
          const firstOpen = nightCoverage(trip).find((n) => n.state === 'undecided');
          if (firstOpen) {
            this.checkIn.set(firstOpen.night);
            this.checkOut.set(addDays(firstOpen.night, 1));
          }
        }
      });
    });
  }

  onPicked(candidate: PlaceCandidate): void {
    const applied = applyPlaceCandidate(createStay({ name: this.name(), address: this.address(), checkIn: '2000-01-01', checkOut: '2000-01-02' }), candidate);
    this.name.set(applied.name);
    this.address.set(applied.address);
    this.location.set(applied.location);
    this.placeRef.set(applied.placeRef);
    this.nameTouched.set(true);
  }

  removeLocation(): void {
    const cleared = clearLocation(createStay({ name: this.name(), address: this.address(), checkIn: '2000-01-01', checkOut: '2000-01-02', location: this.location(), placeRef: this.placeRef() }));
    this.location.set(cleared.location);
    this.placeRef.set(cleared.placeRef);
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();
    const trip = this.trip();
    if (!trip || !this.canSave()) return;
    const base = this.editing();
    const stay = createStay({
      ...(base ?? {}),
      id: base?.id,
      name: this.name(),
      address: this.address().trim(),
      regionId: this.regionId() || null,
      checkIn: this.checkIn(),
      checkOut: this.checkOut(),
      checkInTime: this.checkInTime() || null,
      checkOutTime: this.checkOutTime() || null,
      reservation: this.reservation(),
      memo: this.memo().trim(),
      location: this.location(),
      placeRef: this.placeRef(),
    });
    const stays = base ? trip.stays.map((s) => (s.id === stay.id ? stay : s)) : [...trip.stays, stay];
    const ok = await this.store.commit({ ...trip, stays });
    if (ok) void this.router.navigate(this.backLink(), { queryParams: { tab: 'stays' } });
  }

  async remove(): Promise<void> {
    const trip = this.trip();
    const base = this.editing();
    if (!trip || !base) return;
    const ok = await this.store.commit({ ...trip, stays: trip.stays.filter((s) => s.id !== base.id) });
    if (ok) void this.router.navigate(this.backLink(), { queryParams: { tab: 'stays' } });
  }
}
