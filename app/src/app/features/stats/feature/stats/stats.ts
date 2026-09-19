import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PageBar } from '../../../../core/page-bar';
import { PROVINCE_SHORT_NAME, provinceCodeOf } from '../../../../shared/util/korea-regions';
import { KOREA_GRID, PROVINCE_LABEL_CELL } from '../../data/korea-grid';
import { SEOUL_GRID } from '../../data/seoul-grid';
import { SEOUL_DISTRICT_NAME } from '../../model/seoul-districts';
import { LocalVisitStats } from '../../data/local-visit-stats';
import { VISIT_STATS_REPOSITORY } from '../../data/visit-stats-repository';
import type { RegionVisitCount, VisitedPlace } from '../../model/visit-stats';
import { RegionBlockMap } from '../../ui/region-block-map/region-block-map';
import type { GridCell } from '../../util/hex-geometry';

type View = 'country' | 'province' | 'places';
type LoadState = 'loading' | 'ready' | 'error';

/**
 * 방문 통계 지도.
 *
 * 세 단계를 한 라우트 안에서 오간다. 전국 지도에서 시·도를 고르면 그 안을
 * 보여주고, 구역을 고르면 방문한 장소 목록을 연다.
 *
 * 방문 판정은 여행 종료일이 지났는지로 한다. 사용자가 직접 완료를 선언하는
 * 기능이 아직 없어 날짜를 대신 쓴다(2026-09-18 결정).
 */
@Component({
  selector: 'app-stats',
  providers: [{ provide: VISIT_STATS_REPOSITORY, useClass: LocalVisitStats }],
  imports: [RegionBlockMap, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stats.html',
  styleUrl: './stats.css',
})
export class StatsPage {
  private readonly stats = inject(VISIT_STATS_REPOSITORY);
  private readonly pageBar = inject(PageBar);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loadState = signal<LoadState>('loading');
  readonly view = signal<View>('country');
  /** 선택한 시·도 코드. 전국 화면에서는 null */
  readonly province = signal<string | null>(null);
  /** 선택한 구역 코드. 장소 목록 화면에서만 값이 있다 */
  readonly region = signal<string | null>(null);

  readonly countryCounts = signal<readonly RegionVisitCount[]>([]);
  readonly districtCounts = signal<readonly RegionVisitCount[]>([]);
  readonly places = signal<readonly VisitedPlace[]>([]);
  readonly totalPlaces = signal(0);
  readonly unclassifiedCount = signal(0);

  readonly countryGrid: readonly GridCell[] = KOREA_GRID;
  readonly countryNames = PROVINCE_SHORT_NAME;
  readonly countryLabelCells = PROVINCE_LABEL_CELL;
  readonly seoulGrid: readonly GridCell[] = SEOUL_GRID;
  readonly seoulNames = SEOUL_DISTRICT_NAME;

  /** 방문한 지역 수. 전국 화면의 요약에 쓴다 */
  readonly visitedRegionCount = computed(
    () => this.countryCounts().filter((c) => c.visitCount > 0).length,
  );

  readonly isEmpty = computed(
    () => this.loadState() === 'ready' && this.totalPlaces() === 0,
  );

  /** 서울만 하위 격자가 있다. 나머지 시·도는 장소 목록으로 바로 간다 */
  readonly hasSubGrid = computed(() => this.province() === 'seoul');

  readonly provinceName = computed(() => {
    const code = this.province();
    return code ? (PROVINCE_SHORT_NAME[code] ?? code) : '';
  });

  readonly regionName = computed(() => {
    const code = this.region();
    if (!code) return '';
    return SEOUL_DISTRICT_NAME[code] ?? this.nameFromCounts(code) ?? code;
  });

  constructor() {
    // 화면 안에서 단계를 오가므로 상단 바의 뒤로 가기는 늘 여행 목록을
    // 가리킨다. 단계 사이 이동은 본문의 뒤로 버튼이 맡는다.
    effect(() => {
      this.pageBar.set({ title: this.barTitle(this.view()), back: ['/stats'], action: null });
    });
    void this.load();
  }

  private barTitle(view: View): string {
    if (view === 'country') return '방문 통계';
    if (view === 'province') return this.provinceName();
    return this.regionName();
  }

  private async load(): Promise<void> {
    this.loadState.set('loading');
    try {
      const summary = await this.stats.provinceCounts();
      this.countryCounts.set(summary.regions);
      this.totalPlaces.set(summary.totalPlaces);
      this.unclassifiedCount.set(summary.unclassifiedCount);
      const requested = this.route.snapshot.queryParamMap.get('region');
      if (requested && Object.hasOwn(PROVINCE_SHORT_NAME, requested)) {
        await this.onProvinceSelect(requested);
      } else if (requested && Object.hasOwn(SEOUL_DISTRICT_NAME, requested)) {
        this.province.set('seoul');
        await this.openPlaces(requested);
      }
      this.loadState.set('ready');
    } catch {
      this.loadState.set('error');
    }
  }

  /** 전국 지도에서 시·도를 골랐다. */
  async onProvinceSelect(regionCode: string): Promise<void> {
    const provinceCode = provinceCodeOf(regionCode);
    this.province.set(provinceCode);
    this.region.set(null);

    if (provinceCode === 'seoul') {
      const summary = await this.stats.subRegionCounts(provinceCode);
      this.districtCounts.set(summary.regions);
      this.view.set('province');
      return;
    }

    // 하위 격자가 없는 시·도는 장소 목록으로 바로 간다. 빈 지도를 보여줄
    // 이유가 없다.
    await this.openPlaces(regionCode);
  }

  /** 하위 지도나 목록에서 구역을 골랐다. */
  async onRegionSelect(regionCode: string): Promise<void> {
    await this.openPlaces(regionCode);
  }

  private async openPlaces(regionCode: string): Promise<void> {
    this.region.set(regionCode);
    this.places.set(await this.stats.placesIn(regionCode));
    this.view.set('places');
  }

  backToCountry(): void {
    void this.router.navigate(['/stats']);
  }

  backToProvince(): void {
    if (!this.hasSubGrid()) {
      this.backToCountry();
      return;
    }
    this.view.set('province');
    this.region.set(null);
  }

  openTrip(place: VisitedPlace): void {
    void this.router.navigate(['/trips', place.tripId]);
  }

  private nameFromCounts(code: string): string | null {
    const all = [...this.countryCounts(), ...this.districtCounts()];
    return all.find((c) => c.regionCode === code)?.name ?? null;
  }
}
