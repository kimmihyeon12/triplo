import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PageBar } from '../../../../core/page-bar';
import { ToastService } from '../../../../core/toast-service';
import { UiButton } from '../../../../shared/ui/button/button';
import { IconComponent, type IconName } from '../../../../shared/ui/icon/icon';
import { enumerateDays, formatKoreanDate } from '../../../../shared/util/dates';
import type { DayMapModel, MapBounds, NearbyCategory } from '../../../places/model/map';
import { NEARBY_PLACE_SEARCH, type NearbyPlace } from '../../../places/data/place-search';
import { TripMapComponent } from '../../../places/ui/trip-map/trip-map';
import { TripEditorStore } from '../../data/trip-editor-store';
import type { IsoDate, Trip } from '../../model/trip';
import { buildDayMap } from '../../util/map-markers';
import { addNearbyStop, isInTrip, toPins } from '../../util/map-explore';

const CATEGORIES: readonly { id: NearbyCategory; label: string; icon: IconName }[] = [
  { id: 'meal', label: '맛집', icon: 'meal' },
  { id: 'cafe', label: '카페', icon: 'break' },
  { id: 'sight', label: '관광', icon: 'place' },
  { id: 'stay', label: '숙소', icon: 'bed' },
];

const EMPTY_MAP: DayMapModel = {
  markers: [],
  guideLine: [],
  bounds: null,
  unverifiedActiveCount: 0,
  unverifiedStayCount: 0,
  excludedCount: 0,
};

/** 지도를 이만큼(범위 폭의 비율) 옮기면 '이 지역에서 다시 찾기'를 보인다. */
const MOVED_RATIO = 0.2;

/**
 * 큰 지도에서 주변 장소를 골라 일정에 담기(2026-10-01 사용자 요청). 여행 상세 지도의 '크게 보기'로 연다.
 * 분류를 누르거나 '이 지역에서 다시 찾기'를 누를 때만 검색한다(카카오 무료 한도).
 * 설계: docs/superpowers/specs/2026-10-01-map-explore-design.md
 */
@Component({
  selector: 'app-map-explore',
  imports: [TripMapComponent, UiButton, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './map-explore.html',
})
export class MapExplorePage {
  private readonly store = inject(TripEditorStore);
  private readonly search = inject(NEARBY_PLACE_SEARCH);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly pageBar = inject(PageBar);

  readonly id = input.required<string>();
  /** 여행 상세에서 보던 날(?day=) */
  readonly day = input<string | undefined>();

  readonly categories = CATEGORIES;
  readonly trip = computed<Trip | null>(() => (this.store.current()?.id === this.id() ? this.store.current() : null));
  readonly days = computed<IsoDate[]>(() => {
    const t = this.trip();
    return t?.startDate && t.endDate ? enumerateDays(t.startDate, t.endDate) : [];
  });
  private readonly pickedDay = signal<IsoDate | null>(null);
  readonly selectedDay = computed<IsoDate | null>(() => {
    const days = this.days();
    const d = this.pickedDay() ?? (this.day() as IsoDate | undefined);
    return d && days.includes(d) ? d : (days[0] ?? null);
  });
  readonly dayMap = computed<DayMapModel>(() => {
    const t = this.trip();
    const d = this.selectedDay();
    return t && d ? buildDayMap(t, d) : EMPTY_MAP;
  });

  readonly category = signal<NearbyCategory | null>(null);
  readonly results = signal<readonly NearbyPlace[]>([]);
  readonly searching = signal(false);
  readonly error = signal<string | null>(null);
  readonly empty = signal(false);
  private readonly view = signal<MapBounds | null>(null);
  private readonly searchedView = signal<MapBounds | null>(null);
  /** 지도를 옮겨 지금 결과가 보이는 범위와 달라졌는지 */
  readonly moved = computed(() => {
    const now = this.view();
    const was = this.searchedView();
    if (!now || !was || !this.category()) return false;
    const dx = Math.abs(now.west + now.east - was.west - was.east) / 2;
    const dy = Math.abs(now.south + now.north - was.south - was.north) / 2;
    const zoom = Math.abs(now.east - now.west - (was.east - was.west));
    return dx > (was.east - was.west) * MOVED_RATIO || dy > (was.north - was.south) * MOVED_RATIO || zoom > (was.east - was.west) * 0.4;
  });
  readonly pins = computed(() => {
    const t = this.trip();
    return t ? toPins(t, this.results()) : [];
  });
  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(() => this.results().find((p) => p.id === this.selectedId()) ?? null);
  readonly selectedAdded = computed(() => {
    const t = this.trip();
    const p = this.selected();
    return !!t && !!p && isInTrip(t, p);
  });
  /** 담을 날. 처음에는 지금 보는 날이다. */
  readonly targetDay = signal<IsoDate | ''>('');
  readonly saving = signal(false);

  constructor() {
    effect(() => {
      this.pageBar.set({
        title: '지도에서 담기',
        back: ['/trips', this.id()],
        backQueryParams: this.selectedDay() ? { day: this.selectedDay() } : undefined,
        action: null,
      });
    });
    effect(() => {
      void this.store.open(this.id());
    });
  }

  dayLabel(d: IsoDate): string {
    const i = this.days().indexOf(d);
    return `${i + 1}일차 · ${formatKoreanDate(d)}`;
  }

  pickDay(d: IsoDate): void {
    this.pickedDay.set(d);
  }

  onBounds(bounds: MapBounds): void {
    this.view.set(bounds);
  }

  async pickCategory(id: NearbyCategory): Promise<void> {
    if (this.category() === id) {
      this.category.set(null);
      this.results.set([]);
      this.selectedId.set(null);
      this.empty.set(false);
      this.error.set(null);
      return;
    }
    this.category.set(id);
    await this.find();
  }

  /** 지금 보이는 범위에서 고른 분류를 찾는다. */
  async find(): Promise<void> {
    const category = this.category();
    const bounds = this.view();
    if (!category || !bounds || this.searching()) return;
    this.searching.set(true);
    this.error.set(null);
    this.empty.set(false);
    this.selectedId.set(null);
    try {
      const found = await this.search.nearby(category, bounds);
      if (this.category() !== category) return;
      this.results.set(found);
      this.searchedView.set(bounds);
      this.empty.set(found.length === 0);
    } catch {
      this.results.set([]);
      this.error.set('장소를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      this.searching.set(false);
    }
  }

  select(id: string): void {
    this.selectedId.set(id);
    this.targetDay.set(this.selectedDay() ?? '');
  }

  close(): void {
    this.selectedId.set(null);
  }

  async add(): Promise<void> {
    const trip = this.trip();
    const place = this.selected();
    if (!trip || !place || this.saving()) return;
    if (place.nearby === 'stay') {
      // 숙소는 체크인·체크아웃을 정해야 한다. 장소를 채운 숙소 추가 화면으로 넘긴다.
      void this.router.navigate(['/trips', trip.id, 'stays', 'new'], { state: { place } });
      return;
    }
    this.saving.set(true);
    try {
      const date = this.targetDay() || null;
      const ok = await this.store.commit(addNearbyStop(trip, place, date));
      if (ok) this.toast.success(date ? `${this.dayLabel(date).split(' · ')[0]}에 담았어요` : '날짜 미정으로 담았어요');
    } finally {
      this.saving.set(false);
    }
  }
}
