import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PageBar } from '../../../../core/page-bar';
import {
  KOREA_PROVINCES,
  REGION_LABEL,
  findRegionByCode,
  provinceCodeOf,
} from '../../../../shared/util/korea-regions';
import { LocalVisitStats } from '../../data/local-visit-stats';
import { VISIT_STATS_REPOSITORY } from '../../data/visit-stats-repository';
import type { RegionVisitCount, VisitedPlace } from '../../model/visit-stats';

type View = 'country' | 'places';
type LoadState = 'loading' | 'ready' | 'error';

/**
 * 방문 통계 목록.
 *
 * 3D 지도를 쓸 수 없을 때의 대체 화면이다. 지역을 고르면 그 안에서 다녀온
 * 장소를 보여준다.
 *
 * 예전에는 시·도 격자 → 서울 자치구 격자 → 장소의 세 단계였다. 전국 지도가
 * 시·군·구 단위가 되면서 중간 단계가 필요 없어졌고, 230개를 육각 격자로
 * 손배치할 수도 없어 목록으로 바꿨다(2026-09-22 결정).
 *
 * 방문 판정은 여행 종료일이 지났는지로 한다. 사용자가 직접 완료를 선언하는
 * 기능이 아직 없어 날짜를 대신 쓴다(2026-09-18 결정).
 */
@Component({
  selector: 'app-stats',
  providers: [{ provide: VISIT_STATS_REPOSITORY, useClass: LocalVisitStats }],
  imports: [RouterLink],
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
  /** 고른 시·군·구 코드. 장소 목록 화면에서만 값이 있다 */
  readonly region = signal<string | null>(null);

  readonly countryCounts = signal<readonly RegionVisitCount[]>([]);
  readonly places = signal<readonly VisitedPlace[]>([]);
  readonly totalPlaces = signal(0);
  readonly unclassifiedCount = signal(0);

  /** 다녀온 지역 수. 요약에 쓴다 */
  readonly visitedRegionCount = computed(
    () => this.countryCounts().filter((c) => c.visitCount > 0).length,
  );

  readonly isEmpty = computed(
    () => this.loadState() === 'ready' && this.totalPlaces() === 0,
  );

  /**
   * 다녀온 지역을 시·도로 묶는다. 230개를 한 줄로 늘어놓으면 어디를 다녀왔는지
   * 읽기 어렵다. 시·도 안에서는 많이 간 곳을 앞에 둔다.
   */
  readonly byProvince = computed(() => {
    const groups = new Map<string, { code: string; name: string; regions: RegionVisitCount[]; total: number }>();
    for (const count of this.countryCounts()) {
      if (!count.visitCount) continue;
      const provinceCode = provinceCodeOf(count.regionCode);
      const province = KOREA_PROVINCES.find((p) => p.code === provinceCode);
      const group = groups.get(provinceCode)
        ?? { code: provinceCode, name: province?.short ?? provinceCode, regions: [], total: 0 };
      group.regions.push(count);
      group.total += count.visitCount;
      groups.set(provinceCode, group);
    }
    for (const group of groups.values()) {
      group.regions.sort((a, b) => b.visitCount - a.visitCount || a.name.localeCompare(b.name, 'ko'));
    }
    return [...groups.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'ko'));
  });

  readonly regionName = computed(() => {
    const code = this.region();
    if (!code) return '';
    return REGION_LABEL[code] ?? code;
  });

  constructor() {
    // 화면 안에서 단계를 오가므로 상단 바의 뒤로 가기는 늘 지도를 가리킨다.
    // 단계 사이 이동은 본문의 뒤로 버튼이 맡는다.
    effect(() => {
      this.pageBar.set({
        title: this.view() === 'country' ? '방문 통계' : this.regionName(),
        back: ['/stats'],
        action: null,
      });
    });
    void this.load();
  }

  private async load(): Promise<void> {
    this.loadState.set('loading');
    try {
      const summary = await this.stats.provinceCounts();
      this.countryCounts.set(summary.regions);
      this.totalPlaces.set(summary.totalPlaces);
      this.unclassifiedCount.set(summary.unclassifiedCount);
      const requested = this.route.snapshot.queryParamMap.get('region');
      if (requested && findRegionByCode(requested)) await this.openPlaces(requested);
      this.loadState.set('ready');
    } catch {
      this.loadState.set('error');
    }
  }

  /** 목록에서 지역을 골랐다. */
  async onRegionSelect(regionCode: string): Promise<void> {
    await this.openPlaces(regionCode);
  }

  private async openPlaces(regionCode: string): Promise<void> {
    this.region.set(regionCode);
    this.places.set(await this.stats.placesIn(regionCode));
    this.view.set('places');
  }

  backToCountry(): void {
    this.view.set('country');
    this.region.set(null);
  }

  openTrip(place: VisitedPlace): void {
    void this.router.navigate(['/trips', place.tripId]);
  }
}
