import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PageBar } from '../../../../core/page-bar';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiInput } from '../../../../shared/ui/input/input';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { UiSpinner } from '../../../../shared/ui/spinner/spinner';
import { buildGrid, type GeoCollection } from '../../../../shared/util/geo/geo-grid';
import { createProjection, KOREA_ORIGIN, pointInPolygon } from '../../../../shared/util/geo/projection';
import type { VoxelGrid } from '../../../../shared/util/geo/geo-types';
import { KOREA_REGIONS, PROVINCE_SHORT_NAME, REGION_LABEL } from '../../../../shared/util/korea-regions';
import { LocalVisitStats } from '../../data/local-visit-stats';
import type { ExcludedReasons, RegionVisitCount, VisitedPlace } from '../../model/visit-stats';
import { VoxelScene } from '../../ui/voxel-scene';
import type { MapLabel, RegionMapMarker } from '../../model/map-marker';
import { regionMarkers } from '../../util/region-markers';
import { SavedMapPlaces } from '../../data/saved-map-places';
import { VISIT_STEPS, visitStyle, type VisitPalette } from '../../util/visit-style';
import { monthlyVisits } from '../../util/monthly-visits';
import type { VisitSpot } from '../../util/visit-spots';
import type { SpotAt } from '../../util/block-layout';

/** 경계 파일이 쓰는 속성 이름. 상세는 public/geo/README.md를 따른다. */
const codeOf = (p: Record<string, unknown>): string => String(p['cd']);
const nameOf = (p: Record<string, unknown>): string => String(p['nm']);

@Component({
  selector: 'app-visit-map',
  imports: [DecimalPipe, RouterLink, UiButton, UiInput, IconComponent, UiSpinner],
  providers: [LocalVisitStats, SavedMapPlaces],
  templateUrl: './visit-map.html',
  host: { class: 'block bg-ground text-ink' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisitMapPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly repository = inject(LocalVisitStats);
  private readonly savedPlaces = inject(SavedMapPlaces);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('mapHost');
  private scene?: VoxelScene;
  private grid?: VoxelGrid;
  private geo?: GeoCollection;
  private controller?: AbortController;
  private detailRequest = 0;
  readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  readonly detailState = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly palette = signal<VisitPalette | null>(null);
  readonly actual = signal<readonly RegionVisitCount[]>([]);
  readonly unclassified = signal(0);
  /** 집계되지 않은 여행의 까닭. 통계가 비었을 때 화면에 이유를 보여준다. */
  readonly excluded = signal<ExcludedReasons | null>(null);
  readonly excludedNotes = computed(() => {
    const reasons = this.excluded();
    if (!reasons) return [];
    const notes: string[] = [];
    if (reasons.notEnded) notes.push(`아직 끝나지 않은 여행 ${reasons.notEnded}개는 종료일이 지나면 들어와요.`);
    if (reasons.noEndDate) notes.push(`종료일이 없는 여행이 ${reasons.noEndDate}개 있어요. 날짜를 정하면 집계돼요.`);
    if (reasons.noRegion) notes.push(`지역이 연결되지 않은 여행이 ${reasons.noRegion}개 있어요. 장소에 지역을 지정해 주세요.`);
    if (reasons.emptyItinerary) notes.push(`담긴 장소나 숙소가 없는 여행이 ${reasons.emptyItinerary}개 있어요.`);
    return notes;
  });
  readonly selected = signal<string | null>(null);
  readonly labels = signal<MapLabel[]>([]);
  readonly markers = signal<readonly RegionMapMarker[]>([]);
  /** 실제 다녀온 자리. 시·도 중심이 아니라 여기에 군집을 놓는다. */
  readonly spots = signal<readonly VisitSpot[]>([]);
  readonly selectedMarker = signal<string | null>(null);
  /** 지역 코드 → 화면 이름. 같은 이름이 여럿이면 시·도가 괄호로 붙는다. */
  readonly names = REGION_LABEL;
  readonly counts = this.actual;
  readonly layers = signal(true);
  readonly locating = signal(false);
  readonly locationNotice = signal('');
  readonly places = signal<VisitedPlace[]>([]);
  readonly year = signal(new Date().getFullYear());
  readonly steps = VISIT_STEPS;
  /** 지도에 올라간 장소 수. 배너도 같은 기준을 쓴다(util/visit-total). */
  readonly total = computed(() => this.counts().reduce((sum, c) => sum + c.visitCount, 0));
  readonly countMap = computed(() => new Map(this.counts().map(c => [c.regionCode, c.visitCount])));
  readonly selectedCount = computed(() => this.countMap().get(this.selected() ?? '') ?? 0);
  readonly legendColors = computed(() => { const p = this.palette(); return p ? VISIT_STEPS.map(step => visitStyle(step.min, 0, p).color) : []; });
  /** 시·군·구 230개 전부. 방문 수가 0인 곳도 담는다. */
  readonly allRegions = computed(() => KOREA_REGIONS
    .map(r => ({ regionCode: r.code, key: r.code, name: r.label, provinceCode: r.provinceCode, visitCount: this.countMap().get(r.code) ?? 0 }))
    .sort((a, b) => b.visitCount - a.visitCount || a.name.localeCompare(b.name, 'ko')));
  readonly visitedRegions = computed(() => this.allRegions().filter(r => r.visitCount > 0).length);
  /**
   * 다녀온 곳. 집계가 시·군·구 단위라 지역 하나가 목록 한 줄이 된다.
   * 좌표가 없어 지도에 못 찍은 지역도 여기에는 남는다. 합계가 어긋나면 안 된다.
   */
  readonly visitedList = computed(() => this.allRegions().filter(r => r.visitCount > 0));
  /**
   * 아직 안 간 곳을 시·도별로 묶는다. 220곳이 넘어 한 줄로 늘어놓으면 목록의
   * 대부분을 차지해 실제 기록이 묻힌다. 시·도와 개수만 보여주고 펼쳤을 때
   * 지역을 낸다.
   */
  readonly unvisitedByProvince = computed(() => {
    const groups = new Map<string, { code: string; name: string; regions: { regionCode: string; name: string }[] }>();
    for (const region of this.allRegions()) {
      if (region.visitCount) continue;
      const group = groups.get(region.provinceCode)
        ?? { code: region.provinceCode, name: PROVINCE_SHORT_NAME[region.provinceCode] ?? region.provinceCode, regions: [] };
      group.regions.push({ regionCode: region.regionCode, name: region.name });
      groups.set(region.provinceCode, group);
    }
    for (const group of groups.values()) group.regions.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  });
  readonly unvisitedCount = computed(() => this.allRegions().filter(r => !r.visitCount).length);
  /** 펼쳐 둔 시·도. 안 간 곳 목록에서 하나씩 연다. */
  readonly openProvince = signal<string | null>(null);
  readonly coverage = computed(() => Math.round(this.visitedRegions() / this.allRegions().length * 100));
  readonly months = computed(() => monthlyVisits(this.places(), this.year()));
  readonly monthMax = computed(() => Math.max(1, ...this.months().map(m => m.count)));
  readonly years = computed(() => [...new Set([this.year(), ...this.places().map(p => Number(p.visitedOn.slice(0, 4)))])].sort((a, b) => b - a));
  /**
   * 지도에 그릴 마커.
   *
   * 고른 자리 하나만 띄운다. 아무것도 고르지 않았으면 그리지 않는다. 마커가
   * 모두 떠 있으면 이름표가 서로 겹쳐 지형을 덮고, 어디를 골랐는지도 한눈에
   * 읽히지 않는다(2026-09-22 결정).
   *
   * 마커가 없어도 고를 방법은 남는다. 지도의 방문 블록을 직접 누르거나
   * 오른쪽 '다녀온 지역' 목록에서 고르면 그 자리에 마커가 생긴다.
   */
  readonly visibleLabels = computed(() => {
    const picked = this.selectedMarker();
    if (!picked) return [];
    // 혼자 남았으므로 겹칠 상대가 없다. 이름표를 늘 보여준다.
    return this.labels()
      .filter(label => label.id === picked)
      .map(label => ({ ...label, labelHidden: false }));
  });

  constructor() {
    inject(PageBar).set({ title: '방문 통계', back: ['/trips'], action: null });
    afterNextRender(() => void this.load());
    this.destroyRef.onDestroy(() => { this.detailRequest++; this.controller?.abort(); this.scene?.destroy(); });
  }

  async load(): Promise<void> {
    // 지도가 시·군·구 단위가 되면서 자치구도 여기서 바로 고를 수 있다.
    // 예전에는 서울 자치구만 /stats/details로 넘겼다(2026-09-22 정리).
    this.state.set('loading');
    this.clearSelection();
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    try {
      const [response, summary, markers, spots] = await Promise.all([
        fetch('/geo/korea-municipalities-2026.geo.json', { signal: controller.signal }),
        this.repository.provinceCounts('all'),
        this.savedPlaces.read('all'),
        this.repository.spots(),
      ]);
      if (!response.ok) throw new Error('Boundary load failed');
      const geo = await response.json() as GeoCollection;
      if (controller.signal.aborted || this.destroyRef.destroyed) return;
      this.geo = geo;
      // 격자가 잘면 지형이 모래알처럼 부서져 보인다. 타일을 키워 덩어리로
      // 읽히게 하고, 대신 해안선의 세밀함은 포기한다.
      this.grid = buildGrid(geo, { cellSize: 11, origin: KOREA_ORIGIN,
        codeOf, nameOf });
      this.actual.set(summary.regions);
      this.unclassified.set(summary.unclassifiedCount);
      this.excluded.set(summary.excluded ?? null);
      this.markers.set(regionMarkers(markers, geo, this.names));
      this.spots.set(spots);
      this.scene?.destroy();
      this.scene = undefined;
      const styles = getComputedStyle(this.host().nativeElement);
      const palette = { land: styles.getPropertyValue('--color-map-land').trim(), low: styles.getPropertyValue('--color-map-visit-low').trim(), middle: styles.getPropertyValue('--color-map-visit-middle').trim(), high: styles.getPropertyValue('--color-map-visit-high').trim() };
      this.palette.set(palette);
      this.scene = new VoxelScene(this.host().nativeElement, labels => this.labels.set(labels), (code, temporary) => {
        // 블록 판정이 시·군·구 단위라 누른 블록이 곧 그 지역이다.
        this.selectedMarker.set(temporary ? 'temporary' : code);
        this.scene?.setSelectedMarker(temporary ? 'temporary' : code);
        if (code) void this.select(code, true);
        else if (!temporary) this.clearSelection();
      }, palette);
      this.paint();
      this.state.set('ready');
      const requested = this.route.snapshot.queryParamMap.get('region');
      if (requested && Object.hasOwn(this.names, requested)) void this.select(requested);
    } catch {
      if (!controller.signal.aborted && !this.destroyRef.destroyed) this.state.set('error');
    }
  }

  async select(code: string, keepMarker = false): Promise<void> {
    if (!keepMarker) {
      this.scene?.setSelectedMarker(code);
      this.scene?.clearTemporary();
      // 목록에서 골랐을 때도 그 자리에 마커를 세운다. 마커는 고른 것만
      // 띄우므로(visibleLabels) 여기서 비우면 지도에 아무 표시도 남지 않는다.
      this.selectedMarker.set(this.labels().some(label => label.id === code) ? code : null);
    }
    if (!this.names[code]) { this.reset(); return; }
    this.selected.set(code);
    this.places.set([]);
    this.detailState.set('loading');
    const request = ++this.detailRequest;
    try {
      const places = await this.repository.placesIn(code, 'all');
      if (request !== this.detailRequest || this.destroyRef.destroyed) return;
      this.places.set(places);
      this.year.set(places.length ? Number(places[0].visitedOn.slice(0, 4)) : new Date().getFullYear());
      this.detailState.set('ready');
    } catch {
      if (request === this.detailRequest && !this.destroyRef.destroyed) this.detailState.set('error');
    }
  }

  /**
   * 지도의 마커를 눌렀다.
   *
   * 마커 하나가 시·군·구 하나다. 집계도 같은 단위라 마커 식별자를 그대로 쓴다.
   */
  activateMarker(id: string): void {
    if (id === 'temporary') { this.selectedMarker.set(id); this.scene?.setSelectedMarker(id); return; }
    if (!this.names[id]) return;
    // 지역 선택을 먼저 비운 뒤 누른 자리를 다시 넣는다. 순서가 바뀌면
    // clearSelection이 방금 넣은 값을 지운다.
    this.clearSelection();
    this.selectedMarker.set(id);
    this.scene?.setSelectedMarker(id);
    void this.select(id, true);
  }
  /** 안 간 곳 목록에서 시·도 하나를 펼치거나 접는다. */
  toggleProvince(code: string): void {
    this.openProvince.update(open => (open === code ? null : code));
  }
  clearSelection(): void { this.scene?.setSelectedMarker(null); this.detailRequest++; this.selected.set(null); this.places.set([]); this.detailState.set('idle'); this.selectedMarker.set(null); this.scene?.clearTemporary(); }
  zoom(factor: number): void { this.scene?.zoom(factor); }
  reset(): void { this.scene?.reset(); this.clearSelection(); }
  focus(): void { const marker = this.selectedMarker(); const code = this.selected(); if (marker) this.scene?.focusMarker(marker); else if (code) this.scene?.focus(code); else this.scene?.reset(); }
  toggleLayers(): void { this.layers.update(value => !value); this.paint(); }
  /**
   * 방문 자리를 평면 좌표로 바꾼다. 격자와 같은 투영을 써야 칸을 맞게 고른다.
   * 레이어를 끄면 지형만 보여야 하므로 자리도 비운다.
   */
  private spotsAt(): SpotAt[] {
    if (!this.layers()) return [];
    const project = createProjection(KOREA_ORIGIN);
    return this.spots().map(spot => {
      const { x, y } = project(spot.location);
      return { regionCode: spot.regionCode, name: spot.name, x, y, count: spot.count };
    });
  }

  private paint(): void {
    if (this.grid) this.scene?.setData(this.grid, this.layers() ? this.countMap() : new Map(), this.markers(), this.spotsAt());
  }
  color(count: number): string { const p = this.palette(); return p ? visitStyle(count, 0, p).color : 'var(--color-panel)'; }
  /** 임시 선택은 주 동작색, 저장한 지역은 방문색을 쓴다. */
  markerInk(label: MapLabel): string {
    return label.temporary ? 'var(--color-accent-deep)' : 'var(--color-map-visit-high)';
  }

  locate(): void {
    if (!navigator.geolocation) { this.locationNotice.set('이 브라우저에서는 현재 위치를 확인할 수 없어요.'); return; }
    this.locating.set(true);
    this.locationNotice.set('현재 위치를 확인하고 있어요.');
    navigator.geolocation.getCurrentPosition(position => {
      if (this.destroyRef.destroyed) return;
      this.locating.set(false);
      const point = { x: position.coords.longitude, y: position.coords.latitude };
      const feature = this.geo?.features.find(feature => {
        const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
        return polygons.some(rings => pointInPolygon(point, rings.map(ring => ring.map(([x, y]) => ({ x, y })))));
      });
      const code = feature ? codeOf(feature.properties) : undefined;
      if (!code || !this.names[code]) { this.locationNotice.set('현재 위치가 지원하는 행정구역 경계 안에 없어요.'); return; }
      void this.select(code);
      this.scene?.focus(code);
      this.locationNotice.set(`현재 위치가 속한 ${this.names[code]} 지역이에요. 위치는 저장하지 않아요.`);
    }, () => {
      if (this.destroyRef.destroyed) return;
      this.locating.set(false);
      this.locationNotice.set('위치를 확인하지 못했어요. 위치 권한을 확인하거나 지역을 직접 선택해 주세요.');
    }, { timeout: 10000, maximumAge: 60000 });
  }
}
