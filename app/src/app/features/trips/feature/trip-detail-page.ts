import { TripHeader } from '../ui/trip-header';
import { TripStays } from '../ui/trip-stays';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TripEditorStore } from '../data/trip-editor-store';
import { enumerateDays, formatKoreanDate, formatPeriod } from '../../../shared/util/dates';
import { daySegments, dayStops, dayTotals, fixedTimeConflicts, formatMinutes, moveStop, sortDayByNearest, toggleExcluded } from '../util/itinerary';
import { RESERVATION_LABEL, STOP_KIND_LABEL, type AccommodationStay, type IsoDate, type Trip, type TripStop } from '../model/trip';
import { buildOverview } from '../util/overview';
import { dayStayInfo, nightCoverage, stayIssues, stayNightCount } from '../util/stays';
import { IconComponent } from '../../../shared/ui/icon';
import { PageBar } from '../../../core/page-bar';
import { copyText, kakaoSearchUrl, mapQuery, naverSearchUrl } from '../../places/data/map-links';
import { TripMapComponent } from '../../places/ui/trip-map';
import { buildDayMap, buildStaysMap } from '../util/map-markers';
import { type DayMapModel } from '../../places/model/map';

type Tab = 'overview' | 'days' | 'stays';

@Component({
  selector: 'app-trip-detail-page',
  imports: [RouterLink, IconComponent, TripHeader, TripStays, TripMapComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-detail-page.html',
  styleUrl: './trip-detail-page.css',
})
export class TripDetailPage {
  readonly id = input.required<string>();
  readonly tab = input<string | undefined>();
  readonly day = input<string | undefined>();

  readonly store = inject(TripEditorStore);
  private readonly router = inject(Router);
  private readonly pageBar = inject(PageBar);

  readonly tabs: { id: Tab; ko: string }[] = [
    { id: 'overview', ko: '전체' },
    { id: 'days', ko: '날짜별' },
    { id: 'stays', ko: '숙소' },
  ];
  readonly kindLabel = STOP_KIND_LABEL;

  readonly trip = computed<Trip | null>(() => (this.store.current()?.id === this.id() ? this.store.current() : null));
  readonly overview = computed(() => (this.trip() ? buildOverview(this.trip()!) : { undecidedDates: true, days: [], unassigned: [], issues: [] }));
  readonly isEmptyTrip = computed(() => !!this.trip() && this.trip()!.stops.length === 0 && this.trip()!.stays.length === 0);

  readonly activeTab = computed<Tab>(() => {
    const t = this.tab();
    return t === 'days' || t === 'stays' ? t : 'overview';
  });
  readonly days = computed<IsoDate[]>(() => {
    const t = this.trip();
    return t?.startDate && t.endDate ? enumerateDays(t.startDate, t.endDate) : [];
  });
  readonly selectedDay = computed<IsoDate | null>(() => {
    const d = this.day();
    const days = this.days();
    if (d && days.includes(d)) return d;
    return days[0] ?? null;
  });

  readonly stayInfo = computed(() => dayStayInfo(this.trip()!, this.selectedDay() ?? ''));
  readonly segments = computed(() => (this.selectedDay() ? daySegments(this.trip()!, this.selectedDay()!) : []));
  readonly totals = computed(() => (this.selectedDay() ? dayTotals(this.trip()!, this.selectedDay()!) : dayTotals(this.trip()!, '')));
  readonly conflicts = computed(() => (this.selectedDay() ? fixedTimeConflicts(this.trip()!, this.selectedDay()!) : []));
  readonly dayRegions = computed(() => {
    const d = this.overview().days.find((x) => x.date === this.selectedDay());
    return d?.regionNames ?? [];
  });

  readonly selectedMarkerId = signal<string | null>(null);
  private readonly emptyMap: DayMapModel = { markers: [], guideLine: [], bounds: null, unverifiedActiveCount: 0, unverifiedStayCount: 0, excludedCount: 0 };
  readonly dayMap = computed<DayMapModel>(() => {
    const t = this.trip();
    const d = this.selectedDay();
    return t && d ? buildDayMap(t, d) : this.emptyMap;
  });
  readonly flashId = signal<string | null>(null);
  readonly copiedId = signal<string | null>(null);
  readonly copyFallback = signal(false);
  readonly copyFallbackId = signal<string | null>(null);

  /** 지역을 칩 대신 본문 텍스트 경로로 표시한다(예: 강릉 → 속초). */

  constructor() {
    // 상단 바: ‹ 뒤로, 가운데 여행 제목(길면 말줄임), 오른쪽 편집
    effect(() => {
      const t = this.trip();
      this.pageBar.set({
        title: t?.title ?? '여행',
        back: ['/trips'],
        action: t ? { label: '편집', link: ['/trips', t.id, 'edit'], testId: 'trip-edit' } : null,
      });
    });
    effect(() => {
      const id = this.id();
      void this.store.open(id);
    });
    effect(() => {
      const day = this.selectedDay();
      if (!day || this.activeTab() !== 'days') return;
      const idx = this.days().indexOf(day);
      queueMicrotask(() => document.querySelector(`[data-testid="daytab-${idx + 1}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
    });
  }

  formatDate(d: IsoDate, short = false): string {
    return formatKoreanDate(d, { short });
  }
  minutes(m: number): string {
    return formatMinutes(m);
  }
  summarize(names: string[]): string {
    return names.length <= 4 ? names.join(' → ') : `${names.slice(0, 4).join(' → ')} 외 ${names.length - 4}개`;
  }
  nightCellClass(state: string): string {
    return state === 'covered' ? 'cell--stay' : state === 'conflict' ? 'cell--danger' : state === 'undecided' ? 'cell--warn' : 'cell--ghost';
  }
  regionName(id: string | null): string | null {
    return this.trip()?.regions.find((r) => r.id === id)?.name ?? null;
  }
  segKey(seg: { type: string; stop?: TripStop }, i: number): string {
    return seg.type === 'stop' && seg.stop ? 'stop:' + seg.stop.id : 'leg:' + i;
  }
  isConflicted(stopId: string): boolean {
    return this.conflicts().some((c) => c.earlierId === stopId || c.laterId === stopId);
  }
  private stopIndexes(): number[] {
    return this.segments().map((s, i) => (s.type === 'stop' ? i : -1)).filter((i) => i >= 0);
  }
  /** 제외되지 않은 항목의 순번(1부터) */
  stopNumber(idx: number): number {
    return this.segments()
      .slice(0, idx + 1)
      .filter((s) => s.type === 'stop' && !s.stop.excluded).length;
  }
  isFirst(idx: number): boolean {
    return this.stopIndexes()[0] === idx;
  }
  isLast(idx: number): boolean {
    const arr = this.stopIndexes();
    return arr[arr.length - 1] === idx;
  }

  /** 지도 마커 클릭: 해당 카드를 강조하고 화면에 보이게 한다 */
  onMarkerSelect(id: string): void {
    this.selectedMarkerId.set(id);
    const el = document.getElementById('stop-card-' + id) ?? document.getElementById('stay-card-' + id);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /** 카드 순번 클릭: 지도 마커를 강조한다(같은 항목 다시 클릭 시 해제) */
  selectStop(id: string): void {
    this.selectedMarkerId.set(this.selectedMarkerId() === id ? null : id);
  }

  naverUrl(stop: TripStop): string {
    return naverSearchUrl(mapQuery(stop.name, stop.address));
  }
  kakaoUrl(stop: TripStop): string {
    return kakaoSearchUrl(mapQuery(stop.name, stop.address));
  }

  async move(stopId: string, dir: 'up' | 'down'): Promise<void> {
    const t = this.trip();
    if (!t) return;
    await this.store.commit(moveStop(t, stopId, dir));
    this.flashId.set(stopId);
    setTimeout(() => this.flashId.set(null), 320);
  }

  async toggle(stopId: string): Promise<void> {
    const t = this.trip();
    if (!t) return;
    await this.store.commit(toggleExcluded(t, stopId));
  }

  /** 그날 방문할 곳의 수. 제외한 항목은 세지 않는다. */
  readonly stopCount = computed(() => {
    const t = this.trip();
    const day = this.selectedDay();
    if (!t || !day) return 0;
    return dayStops(t, day).filter((s) => !s.excluded).length;
  });

  /** 좌표가 있고 고정 시각이 없는 항목이 둘 이상일 때만 정렬할 수 있다. */
  readonly canSortByNearest = computed(() => {
    const t = this.trip();
    const day = this.selectedDay();
    if (!t || !day) return false;
    return dayStops(t, day).filter((s) => s.fixedTime === null && s.location !== null).length >= 2;
  });

  /** 정렬 뒤 무엇이 자리를 지켰는지 알린다. 비면 표시하지 않는다. */
  readonly sortNotice = signal<string | null>(null);

  async sortByNearest(): Promise<void> {
    const t = this.trip();
    const day = this.selectedDay();
    if (!t || !day) return;
    const r = sortDayByNearest(t, day);
    await this.store.commit(r.trip);

    const kept: string[] = [];
    if (r.fixedCount > 0) kept.push(`고정 시각 ${r.fixedCount}개`);
    if (r.unlocatedCount > 0) kept.push(`위치 미확인 ${r.unlocatedCount}개`);
    this.sortNotice.set(
      kept.length > 0
        ? `${r.sortedCount}개를 가까운 순으로 정렬했습니다. ${kept.join('·')}는 자리를 지켰습니다.`
        : `${r.sortedCount}개를 가까운 순으로 정렬했습니다.`,
    );
  }

  async copyAddress(stop: TripStop): Promise<void> {
    const ok = await copyText(stop.address);
    if (ok) {
      this.copiedId.set(stop.id);
      this.copyFallback.set(false);
      setTimeout(() => this.copiedId.set(null), 1500);
    } else {
      this.copyFallback.set(true);
      this.copyFallbackId.set(stop.id);
    }
  }

  onDayKey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const days = this.days();
    const cur = days.indexOf(this.selectedDay() ?? '');
    if (cur < 0) return;
    const next = event.key === 'ArrowRight' ? Math.min(days.length - 1, cur + 1) : Math.max(0, cur - 1);
    if (next === cur) return;
    event.preventDefault();
    void this.router.navigate([], { queryParams: { tab: 'days', day: days[next] }, queryParamsHandling: 'merge' }).then(() => {
      const el = document.querySelector<HTMLElement>(`[data-testid="daytab-${next + 1}"]`);
      el?.focus();
    });
  }
}
