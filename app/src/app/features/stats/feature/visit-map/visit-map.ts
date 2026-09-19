import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PageBar } from '../../../../core/page-bar';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiInput } from '../../../../shared/ui/input/input';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { UiSpinner } from '../../../../shared/ui/spinner/spinner';
import { buildGrid, type GeoCollection } from '../../../../shared/util/geo/geo-grid';
import { KOREA_ORIGIN, pointInPolygon } from '../../../../shared/util/geo/projection';
import type { VoxelGrid } from '../../../../shared/util/geo/geo-types';
import { PROVINCE_SHORT_NAME } from '../../../../shared/util/korea-regions';
import { LocalVisitStats } from '../../data/local-visit-stats';
import type { RegionVisitCount, VisitedPlace } from '../../model/visit-stats';
import { SEOUL_DISTRICT_NAME } from '../../model/seoul-districts';
import { VoxelScene } from '../../ui/voxel-scene';
import type { MapLabel, RegionMapMarker } from '../../model/map-marker';
import { regionMarkers } from '../../util/region-markers';
import { SavedMapPlaces } from '../../data/saved-map-places';
import { VISIT_STEPS, visitStyle, type VisitPalette } from '../../util/visit-style';
import { monthlyVisits } from '../../util/monthly-visits';

const CODES: Record<string, string> = {
  '11': 'seoul', '21': 'busan', '22': 'daegu', '23': 'incheon', '24': 'gwangju', '25': 'daejeon',
  '26': 'ulsan', '29': 'sejong', '31': 'gyeonggi', '32': 'gangwon', '33': 'chungbuk',
  '34': 'chungnam', '35': 'jeonbuk', '36': 'jeonnam', '37': 'gyeongbuk', '38': 'gyeongnam', '39': 'jeju',
};

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
  readonly selected = signal<string | null>(null);
  readonly labels = signal<MapLabel[]>([]);
  readonly markers = signal<readonly RegionMapMarker[]>([]);
  readonly selectedMarker = signal<string | null>(null);
  readonly activeMarker = computed(() => this.markers().find(marker => marker.id === this.selectedMarker()));
  readonly names = PROVINCE_SHORT_NAME;
  readonly counts = this.actual;
  readonly layers = signal(true);
  readonly locating = signal(false);
  readonly locationNotice = signal('');
  readonly places = signal<VisitedPlace[]>([]);
  readonly year = signal(new Date().getFullYear());
  readonly steps = VISIT_STEPS;
  readonly total = computed(() => this.counts().reduce((sum, c) => sum + c.visitCount, 0));
  readonly countMap = computed(() => new Map(this.counts().map(c => [c.regionCode, c.visitCount])));
  readonly selectedCount = computed(() => this.countMap().get(this.selected() ?? '') ?? 0);
  readonly legendColors = computed(() => { const p = this.palette(); return p ? VISIT_STEPS.map(step => visitStyle(step.min, 0, p).color) : []; });
  readonly allRegions = computed(() => Object.entries(this.names).map(([regionCode, name]) => ({ regionCode, name, visitCount: this.countMap().get(regionCode) ?? 0 })).sort((a, b) => b.visitCount - a.visitCount));
  readonly visitedRegions = computed(() => this.allRegions().filter(r => r.visitCount > 0).length);
  readonly coverage = computed(() => Math.round(this.visitedRegions() / this.allRegions().length * 100));
  readonly months = computed(() => monthlyVisits(this.places(), this.year()));
  readonly monthMax = computed(() => Math.max(1, ...this.months().map(m => m.count)));
  readonly years = computed(() => [...new Set([this.year(), ...this.places().map(p => Number(p.visitedOn.slice(0, 4)))])].sort((a, b) => b - a));
  readonly visibleLabels = this.labels;

  constructor() {
    inject(PageBar).set({ title: '방문 통계', back: ['/trips'], action: null });
    afterNextRender(() => void this.load());
    this.destroyRef.onDestroy(() => { this.detailRequest++; this.controller?.abort(); this.scene?.destroy(); });
  }

  async load(): Promise<void> {
    const requestedRegion = this.route.snapshot.queryParamMap.get('region');
    if (requestedRegion && Object.hasOwn(SEOUL_DISTRICT_NAME, requestedRegion)) {
      await this.router.navigate(['/stats/details'], { queryParams: { region: requestedRegion }, replaceUrl: true });
      return;
    }
    this.state.set('loading');
    this.clearSelection();
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    try {
      const [response, summary, markers] = await Promise.all([
        fetch('/geo/korea-provinces-2013.geo.json', { signal: controller.signal }),
        this.repository.provinceCounts('all'),
        this.savedPlaces.read('all'),
      ]);
      if (!response.ok) throw new Error('Boundary load failed');
      const geo = await response.json() as GeoCollection;
      if (controller.signal.aborted || this.destroyRef.destroyed) return;
      this.geo = geo;
      this.grid = buildGrid(geo, { cellSize: 6.5, origin: KOREA_ORIGIN,
        codeOf: p => CODES[String(p['code'])] ?? String(p['code']), nameOf: p => String(p['name']) });
      this.actual.set(summary.regions);
      this.unclassified.set(summary.unclassifiedCount);
      this.markers.set(regionMarkers(markers, geo, CODES, this.names));
      this.scene?.destroy();
      this.scene = undefined;
      const styles = getComputedStyle(this.host().nativeElement);
      const palette = { land: styles.getPropertyValue('--color-map-land').trim(), low: styles.getPropertyValue('--color-map-visit-low').trim(), middle: styles.getPropertyValue('--color-map-visit-middle').trim(), high: styles.getPropertyValue('--color-map-visit-high').trim() };
      this.palette.set(palette);
      this.scene = new VoxelScene(this.host().nativeElement, labels => this.labels.set(labels), (code, temporary) => {
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
    if (!keepMarker) this.scene?.setSelectedMarker(code);
    if (!keepMarker) { this.selectedMarker.set(null); this.scene?.clearTemporary(); }
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

  activateMarker(id: string): void {
    this.scene?.setSelectedMarker(id);
    if (id === 'temporary') { this.selectedMarker.set(id); return; }
    const marker = this.markers().find(value => value.id === id);
    if (!marker) return;
    this.clearSelection();
    this.selectedMarker.set(id);
    this.scene?.setSelectedMarker(id);
    void this.select(marker.id, true);
  }
  clearSelection(): void { this.scene?.setSelectedMarker(null); this.detailRequest++; this.selected.set(null); this.places.set([]); this.detailState.set('idle'); this.selectedMarker.set(null); this.scene?.clearTemporary(); }
  zoom(factor: number): void { this.scene?.zoom(factor); }
  reset(): void { this.scene?.reset(); this.clearSelection(); }
  focus(): void { const marker = this.selectedMarker(); const code = this.selected(); if (marker) this.scene?.focusMarker(marker); else if (code) this.scene?.focus(code); else this.scene?.reset(); }
  toggleLayers(): void { this.layers.update(value => !value); this.paint(); }
  private paint(): void { if (this.grid) this.scene?.setData(this.grid, this.layers() ? this.countMap() : new Map(), this.markers()); }
  color(count: number): string { const p = this.palette(); return p ? visitStyle(count, 0, p).color : 'var(--color-panel)'; }

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
      const code = feature ? CODES[String(feature.properties['code'])] : undefined;
      if (!code) { this.locationNotice.set('현재 위치가 지원하는 시·도 경계 안에 없어요.'); return; }
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
