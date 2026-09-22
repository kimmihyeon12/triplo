import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../../shared/ui/icon/icon';
import { LocalVisitStats } from '../../data/local-visit-stats';
import { KOREA_REGIONS } from '../../../../shared/util/korea-regions';
import type { VisitPalette } from '../../util/visit-style';
import { mappedTotal } from '../../util/visit-total';
import {
  BANNER_VIEWBOX,
  JEJU,
  MAINLAND_PATH,
  OUTLINE,
  visitDots,
} from './banner-shape';

/**
 * 전국 시·군·구 수. 진행 막대의 분모다.
 *
 * 통계 화면과 같은 기준을 쓴다. 한쪽은 시·도, 다른 쪽은 시·군·구로 세면
 * 같은 기록인데 화면마다 다른 숫자가 나와 어느 쪽이 맞는지 알 수 없다
 * (2026-09-22 확인).
 */
const REGION_COUNT = KOREA_REGIONS.length;

/**
 * 서버 렌더링에는 계산된 스타일이 없다. 토큰을 읽기 전까지 쓸 기본값을 둔다.
 * 실제 값은 첫 렌더 뒤 theme.css에서 읽어 덮어쓴다.
 */
const FALLBACK_PALETTE: VisitPalette = {
  land: '#fcfdfe',
  low: '#c9eaf0',
  middle: '#3fb3c9',
  high: '#0d5563',
};

/** 지도 화면과 같은 토큰을 쓴다. 배너와 지도의 색이 어긋나면 안 된다. */
function readPalette(): VisitPalette {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;
  return {
    land: read('--color-map-land', FALLBACK_PALETTE.land),
    low: read('--color-map-visit-low', FALLBACK_PALETTE.low),
    middle: read('--color-map-visit-middle', FALLBACK_PALETTE.middle ?? ''),
    high: read('--color-map-visit-high', FALLBACK_PALETTE.high),
  };
}

/**
 * 여행 목록 맨 위에서 기록 지도로 보내는 배너.
 *
 * 세 상태를 가진다. 기록이 쌓였으면 다녀온 시·도 수와 누적 방문을 보이고,
 * 아직 없으면 점선 테두리의 가라앉은 모습으로 언제 채워지는지만 알린다.
 * 기록이 없을 때 숨기지 않는 이유는 기능의 존재를 처음부터 알리기 위해서다.
 */
@Component({
  selector: 'app-visit-map-banner',
  imports: [RouterLink, DecimalPipe, IconComponent],
  providers: [LocalVisitStats],
  templateUrl: './visit-map-banner.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisitMapBanner {
  private readonly stats = inject(LocalVisitStats);

  readonly regionCount = REGION_COUNT;
  readonly visitedCount = signal(0);
  readonly totalVisits = signal(0);

  /** 집계 전이나 실패 시에도 배너는 빈 상태로 남는다. 오류 문구는 띄우지 않는다. */
  readonly loaded = signal(false);

  private readonly counts = signal<ReadonlyMap<string, number>>(new Map());
  private readonly palette = signal<VisitPalette>(FALLBACK_PALETTE);

  readonly hasRecord = computed(() => this.loaded() && this.totalVisits() > 0);

  /**
   * 다녀온 지역 비율. 막대를 채우는 값이다.
   *
   * 230이 분모라 초반에는 1~2%다. 퍼센트를 글자로 적지 않고 막대로만 쓰는
   * 까닭이며, 글자로는 '230개 지역 중 32곳'처럼 센 수를 보여준다.
   */
  readonly coverage = computed(() =>
    Math.round((this.visitedCount() / this.regionCount) * 100),
  );

  /** 섬네일의 고정 도형. 템플릿이 좌표를 계산하지 않도록 여기서 내보낸다. */
  readonly viewBox = BANNER_VIEWBOX;
  readonly mainland = MAINLAND_PATH;
  readonly jeju = JEJU;
  readonly outline = OUTLINE;

  readonly land = computed(() => this.palette().land);
  readonly dots = computed(() => visitDots(this.counts(), this.palette()));

  constructor() {
    afterNextRender(() => this.palette.set(readPalette()));
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const summary = await this.stats.provinceCounts();
      // 다녀온 시·군·구 수. 통계 화면의 '다녀온 지역'과 같은 값이다.
      this.visitedCount.set(summary.regions.length);
      // 지도에 올라간 몫만 센다. totalPlaces를 그대로 쓰면 분류하지 못한
      // 장소까지 더해져 통계 화면의 합계보다 커진다.
      this.totalVisits.set(mappedTotal(summary));
      this.counts.set(new Map(summary.regions.map((r) => [r.regionCode, r.visitCount])));
    } catch {
      // 목록 화면의 곁다리 요소다. 읽지 못해도 여행 목록을 막지 않는다.
      this.visitedCount.set(0);
      this.totalVisits.set(0);
      this.counts.set(new Map());
    } finally {
      this.loaded.set(true);
    }
  }
}
