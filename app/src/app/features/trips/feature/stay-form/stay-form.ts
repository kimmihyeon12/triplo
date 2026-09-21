import { UiField } from '../../../../shared/ui/field/field';
import { UiCheckbox } from '../../../../shared/ui/checkbox/checkbox';
import { UiActionBar } from '../../../../shared/ui/action-bar/action-bar';
import { UiNotice } from '../../../../shared/ui/notice/notice';
import { UiBadge } from '../../../../shared/ui/badge/badge';
import { UiInput } from '../../../../shared/ui/input/input';
import { UiButton } from '../../../../shared/ui/button/button';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TripEditorStore } from '../../data/trip-editor-store';
import { addDays, formatPeriod } from '../../../../shared/util/dates';
import { createStay } from '../../util/factories';
import {
  RESERVATION_LABEL,
  type AccommodationStay,
  type ReservationState,
  type Trip,
} from '../../model/trip';
import { nightCoverage, stayNightCount, stayWarnings, validateStayDates } from '../../util/stays';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { PageBar } from '../../../../core/page-bar';
import { PlaceSearchBoxComponent } from '../../../places/ui/place-search-box/place-search-box';
import { SaveStatusComponent } from '../../../../shared/ui/save-status/save-status';
import { applyPlaceCandidate, clearLocation } from '../../util/location';
import { regionIdForAddress } from '../../util/region-match';
import { type PlaceCandidate } from '../../../places/model/place';
import type { GeoPoint, PlaceRef } from '../../../places/model/place';

@Component({
  selector: 'app-stay-form',
  imports: [
    UiButton,
    UiInput,
    UiBadge,
    UiNotice,
    UiActionBar,
    UiField,
    UiCheckbox,
    FormsModule,
    RouterLink,
    IconComponent,
    SaveStatusComponent,
    PlaceSearchBoxComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stay-form.html',
})
export class StayFormPage {
  readonly id = input.required<string>();
  readonly stayId = input<string | undefined>();
  readonly store = inject(TripEditorStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
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
  readonly estimatedCost = signal<number | null>(null);
  readonly costValid = computed(
    () =>
      this.estimatedCost() === null ||
      (Number.isSafeInteger(this.estimatedCost()) &&
        this.estimatedCost()! >= 0 &&
        this.estimatedCost()! <= 1_000_000_000),
  );
  readonly memo = signal('');
  readonly warningsConfirmed = signal(false);
  readonly confirmDelete = signal(false);
  readonly nameTouched = signal(false);
  readonly datesTouched = signal(false);
  readonly location = signal<GeoPoint | null>(null);
  readonly placeRef = signal<PlaceRef | null>(null);
  readonly providerLabel = computed(() =>
    this.placeRef()?.provider === 'kakao'
      ? '카카오'
      : this.placeRef()?.provider === 'fixture'
        ? '테스트 픽스처'
        : '',
  );
  /** 두 날짜를 모두 입력했거나 필드를 떠난 뒤에만 날짜 오류를 보여준다. */
  readonly showDateError = computed(
    () => !!this.dateError() && (this.datesTouched() || (!!this.checkIn() && !!this.checkOut())),
  );

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
  readonly dateError = computed(() =>
    this.dateValidation().ok ? null : (this.dateValidation() as { message: string }).message,
  );
  readonly nightsText = computed(() =>
    this.dateValidation().ok
      ? `${stayNightCount({ checkIn: this.checkIn(), checkOut: this.checkOut() })}박`
      : '',
  );
  readonly warnings = computed(() => {
    const t = this.trip();
    if (!t || !this.dateValidation().ok) return [];
    return stayWarnings(t, {
      id: this.editing()?.id ?? '__new__',
      checkIn: this.checkIn(),
      checkOut: this.checkOut(),
    });
  });
  readonly canSave = computed(
    () =>
      !this.nameError() &&
      this.costValid() &&
      this.dateValidation().ok &&
      (this.warnings().length === 0 || this.warningsConfirmed()) &&
      this.store.saveState() !== 'saving',
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
    effect((onCleanup) => {
      let active = true;
      onCleanup(() => {
        active = false;
      });
      const id = this.id();
      this.trip.set(null);
      this.editing.set(null);
      this.name.set('');
      this.address.set('');
      this.regionId.set('');
      this.checkIn.set('');
      this.checkOut.set('');
      this.checkInTime.set('');
      this.checkOutTime.set('');
      this.reservation.set('unknown');
      this.memo.set('');
      this.estimatedCost.set(null);
      this.location.set(null);
      this.placeRef.set(null);
      this.nameTouched.set(false);
      this.datesTouched.set(false);
      this.warningsConfirmed.set(false);
      this.confirmDelete.set(false);
      const stayId = this.stayId();
      void this.store.open(id).then((trip) => {
        if (!active) return;
        this.trip.set(trip);
        if (!trip) return;
        const stay = stayId ? (trip.stays.find((s) => s.id === stayId) ?? null) : null;
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
          this.estimatedCost.set(stay.estimatedCost ?? null);
          this.location.set(stay.location ?? null);
          this.placeRef.set(stay.placeRef ?? null);
        } else if (
          trip.startDate &&
          trip.endDate &&
          trip.startDate !== trip.endDate &&
          !this.checkIn()
        ) {
          // 기본값은 여행 기간 전체다. 한 숙소에 계속 묵는 경우가 가장 많고,
          // 나눠 묵을 때는 사용자가 줄이는 편이 손이 덜 간다.
          this.checkIn.set(trip.startDate);
          this.checkOut.set(trip.endDate);
        }
      });
    });
  }

  onPicked(candidate: PlaceCandidate): void {
    const applied = applyPlaceCandidate(
      createStay({
        name: this.name(),
        address: this.address(),
        checkIn: '2000-01-01',
        checkOut: '2000-01-02',
      }),
      candidate,
    );
    this.name.set(applied.name);
    this.address.set(applied.address);
    this.location.set(applied.location);
    this.placeRef.set(applied.placeRef);
    this.nameTouched.set(true);
  }

  removeLocation(): void {
    const cleared = clearLocation(
      createStay({
        name: this.name(),
        address: this.address(),
        checkIn: '2000-01-01',
        checkOut: '2000-01-02',
        location: this.location(),
        placeRef: this.placeRef(),
      }),
    );
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
      // 지역은 고르게 하지 않고 주소에서 찾는다. 대개 답이 하나뿐이다.
      regionId: regionIdForAddress(this.address().trim(), trip.regions),
      checkIn: this.checkIn(),
      checkOut: this.checkOut(),
      checkInTime: this.checkInTime() || null,
      checkOutTime: this.checkOutTime() || null,
      reservation: this.reservation(),
      memo: this.memo().trim(),
      estimatedCost: this.estimatedCost(),
      location: this.location(),
      placeRef: this.placeRef(),
    });
    const stays = base
      ? trip.stays.map((s) => (s.id === stay.id ? stay : s))
      : [...trip.stays, stay];
    const ok = await this.store.commit({ ...trip, stays });
    if (ok && !this.destroyRef.destroyed && this.id() === trip.id)
      // 일을 마친 폼은 히스토리에서 치운다. 그대로 두면 상세에서 뒤로 갔을 때
      // 방금 저장한 숙소의 입력 화면이 다시 나타난다.
      void this.router.navigate(this.backLink(), { queryParams: { tab: 'stays' }, replaceUrl: true });
  }

  async remove(): Promise<void> {
    const trip = this.trip();
    const base = this.editing();
    if (!trip || !base) return;
    const ok = await this.store.commit({
      ...trip,
      stays: trip.stays.filter((s) => s.id !== base.id),
    });
    if (ok && !this.destroyRef.destroyed && this.id() === trip.id)
      // 지운 숙소의 폼으로 되돌아갈 수 있으면 없는 것을 편집하게 된다.
      void this.router.navigate(this.backLink(), { queryParams: { tab: 'stays' }, replaceUrl: true });
  }
}
