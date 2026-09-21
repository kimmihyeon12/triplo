import { UiField } from '../../../../shared/ui/field/field';
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
import { enumerateDays, formatKoreanDate } from '../../../../shared/util/dates';
import { appendStop, removeStop, updateStop } from '../../util/itinerary';
import { createStop } from '../../util/factories';
import {
  STOP_KIND_DEFAULT_NAME,
  STOP_KIND_LABEL,
  type StopKind,
  type Trip,
  type TripStop,
} from '../../model/trip';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { PageBar } from '../../../../core/page-bar';
import { PlaceSearchBoxComponent } from '../../../places/ui/place-search-box/place-search-box';
import { SaveStatusComponent } from '../../../../shared/ui/save-status/save-status';
import { applyPlaceCandidate, clearLocation } from '../../util/location';
import { regionIdForAddress } from '../../util/region-match';
import { type PlaceCandidate } from '../../../places/model/place';
import type { GeoPoint, PlaceRef } from '../../../places/model/place';

@Component({
  selector: 'app-stop-form',
  imports: [
    UiButton,
    UiInput,
    UiBadge,
    UiNotice,
    UiActionBar,
    UiField,
    FormsModule,
    RouterLink,
    IconComponent,
    SaveStatusComponent,
    PlaceSearchBoxComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stop-form.html',
})
export class StopFormPage {
  readonly id = input.required<string>();
  readonly stopId = input<string | undefined>();
  /** 새 항목의 기본 종류·날짜(쿼리) */
  readonly kindParam = input<string | undefined>(undefined, { alias: 'kind' });
  readonly dateParam = input<string | undefined>(undefined, { alias: 'date' });

  readonly store = inject(TripEditorStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pageBar = inject(PageBar);

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
  readonly estimatedCost = signal<number | null>(null);
  readonly costValid = computed(
    () =>
      this.estimatedCost() === null ||
      (Number.isSafeInteger(this.estimatedCost()) &&
        this.estimatedCost()! >= 0 &&
        this.estimatedCost()! <= 1_000_000_000),
  );
  readonly memo = signal('');
  readonly confirmDelete = signal(false);
  readonly nameTouched = signal(false);
  readonly location = signal<GeoPoint | null>(null);
  readonly placeRef = signal<PlaceRef | null>(null);
  readonly providerLabel = computed(() =>
    this.placeRef()?.provider === 'kakao'
      ? '카카오'
      : this.placeRef()?.provider === 'fixture'
        ? '테스트 픽스처'
        : '',
  );

  readonly days = computed(() => {
    const t = this.trip();
    if (!t?.startDate || !t.endDate) return [];
    return enumerateDays(t.startDate, t.endDate).map((d, i) => ({
      date: d,
      label: `${i + 1}일차 · ${formatKoreanDate(d)}`,
    }));
  });

  readonly nameError = computed(() =>
    this.kind() === 'place' && !this.name().trim() ? '장소 이름을 입력하세요.' : null,
  );
  readonly stayError = computed(() => {
    const v = this.stayMinutes();
    if (v === null || v === '' || v === undefined) return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 ? null : '0 이상의 분 단위로 입력하세요.';
  });
  readonly canSave = computed(
    () =>
      !this.nameError() &&
      this.costValid() &&
      !this.stayError() &&
      this.store.saveState() !== 'saving',
  );

  readonly backLink = computed(() => ['/trips', this.id()]);
  // Undated stops land in the itinerary tab's unassigned list.
  readonly backQuery = computed(() =>
    this.date() ? { tab: 'days', day: this.date() } : { tab: 'days' },
  );

  constructor() {
    // 상단 바: ‹ 뒤로 + 화면 제목. 저장은 하단 고정 바에 둔다.
    effect(() => {
      this.pageBar.set({
        title: this.isEdit() ? '장소·활동 편집' : '장소·활동 추가',
        back: this.backLink(),
        backQueryParams: this.backQuery(),
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
      this.kind.set('place');
      this.name.set('');
      this.address.set('');
      this.regionId.set('');
      this.date.set('');
      this.stayMinutes.set(null);
      this.fixedTime.set('');
      this.memo.set('');
      this.estimatedCost.set(null);
      this.location.set(null);
      this.placeRef.set(null);
      this.nameTouched.set(false);
      this.confirmDelete.set(false);
      const stopId = this.stopId();
      void this.store.open(id).then((trip) => {
        if (!active) return;
        this.trip.set(trip);
        if (!trip) return;
        const stop = stopId ? (trip.stops.find((s) => s.id === stopId) ?? null) : null;
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
          this.estimatedCost.set(stop.estimatedCost ?? null);
          this.location.set(stop.location ?? null);
          this.placeRef.set(stop.placeRef ?? null);
        } else {
          const k = this.kindParam();
          if (k && (this.kinds as string[]).includes(k)) this.setKind(k as StopKind);
          const d = this.dateParam();
          if (
            d &&
            trip.startDate &&
            trip.endDate &&
            enumerateDays(trip.startDate, trip.endDate).includes(d)
          )
            this.date.set(d);
        }
      });
    });
  }

  onPicked(candidate: PlaceCandidate): void {
    const applied = applyPlaceCandidate(
      createStop({ name: this.name(), address: this.address() }),
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
      createStop({
        name: this.name(),
        address: this.address(),
        location: this.location(),
        placeRef: this.placeRef(),
      }),
    );
    this.location.set(cleared.location);
    this.placeRef.set(cleared.placeRef);
  }

  setKind(k: StopKind): void {
    const prevDefault = STOP_KIND_DEFAULT_NAME[this.kind()];
    this.kind.set(k);
    if (!this.name().trim() || this.name() === prevDefault)
      this.name.set(STOP_KIND_DEFAULT_NAME[k]);
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();
    const trip = this.trip();
    if (!trip || !this.canSave()) return;
    const raw = this.stayMinutes();
    const stayMinutes = raw === null || raw === '' ? null : Number(raw);
    const base = this.editing();
    const address = this.address().trim();
    const stop = createStop({
      ...(base ?? {}),
      id: base?.id,
      kind: this.kind(),
      name: this.name(),
      address,
      // 지역은 고르게 하지 않고 주소에서 찾는다. 대개 답이 하나뿐이다.
      regionId: regionIdForAddress(address, trip.regions),
      date: this.date() || null,
      stayMinutes,
      fixedTime: this.fixedTime() || null,
      memo: this.memo().trim(),
      estimatedCost: this.estimatedCost(),
      excluded: base?.excluded ?? false,
      location: this.location(),
      placeRef: this.placeRef(),
    });
    const next = base ? updateStop(trip, stop) : appendStop(trip, stop);
    const ok = await this.store.commit(next);
    if (ok && !this.destroyRef.destroyed && this.id() === trip.id)
      // 일을 마친 폼은 히스토리에서 치운다. 그대로 두면 상세에서 뒤로 갔을 때
      // 방금 저장한 활동의 입력 화면이 다시 나타난다.
      void this.router.navigate(this.backLink(), { queryParams: this.backQuery(), replaceUrl: true });
  }

  async remove(): Promise<void> {
    const trip = this.trip();
    const base = this.editing();
    if (!trip || !base) return;
    const ok = await this.store.commit(removeStop(trip, base.id));
    if (ok && !this.destroyRef.destroyed && this.id() === trip.id)
      // 지운 활동의 폼으로 되돌아갈 수 있으면 없는 것을 편집하게 된다.
      void this.router.navigate(this.backLink(), { queryParams: this.backQuery(), replaceUrl: true });
  }
}
