import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { RegionVisitCount } from '../../model/visit-stats';
import {
  type Bounds,
  type GridCell,
  MAX_LEVEL,
  blockShape,
  boundsOf,
  drawOrder,
  heightLevel,
  hexCenter,
} from '../../util/hex-geometry';

/** 화면에 그릴 블록 하나. 템플릿이 쓰기 좋은 형태로 미리 계산한다. */
export interface Block {
  regionCode: string;
  name: string;
  visitCount: number;
  level: number;
  top: string;
  left: string;
  right: string;
  /** 라벨 자리. 블록 꼭대기 위다 */
  labelX: number;
  labelY: number;
  /** 라벨을 붙일 대표 칸인지 */
  isLabel: boolean;
}

/**
 * 방문 횟수를 아이소메트릭 블록으로 그린다.
 *
 * 3D 라이브러리를 쓰지 않는다. 시점이 고정이라 실제 3D의 이점이 없고,
 * 기획안 11절이 전체 지도를 3D로 만들지 말라고 정하고 있다.
 *
 * 방문이 없는 지역은 바닥에 눕힌 회색 블록으로 남긴다. 가본 것처럼 칠하지
 * 않는다(기획안 6절).
 */
@Component({
  selector: 'app-region-block-map',
  templateUrl: './region-block-map.html',
  styleUrl: './region-block-map.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegionBlockMap {
  readonly cells = input.required<readonly GridCell[]>();
  readonly counts = input.required<readonly RegionVisitCount[]>();
  /** 격자 코드를 표시 이름으로 바꾸는 표 */
  readonly names = input.required<Record<string, string>>();
  /** 라벨을 붙일 대표 칸. 여러 칸을 가진 지역에 쓴다 */
  readonly labelCells = input<Record<string, GridCell> | null>(null);

  readonly select = output<string>();

  readonly maxLevel = MAX_LEVEL;

  private readonly countByCode = computed(
    () => new Map(this.counts().map((c) => [c.regionCode, c.visitCount])),
  );

  private readonly maxCount = computed(() =>
    this.counts().reduce((max, c) => Math.max(max, c.visitCount), 0),
  );

  readonly bounds = computed<Bounds>(() => boundsOf(this.cells()));

  readonly viewBox = computed(() => {
    const b = this.bounds();
    if (b.width === 0) return '0 0 1 1';
    return `${b.minX} ${b.minY} ${b.width} ${b.height}`;
  });

  readonly blocks = computed<Block[]>(() => {
    const counts = this.countByCode();
    const max = this.maxCount();
    const names = this.names();
    const labels = this.labelCells();

    return drawOrder(this.cells()).map((cell) => {
      const visitCount = counts.get(cell.regionCode) ?? 0;
      const level = heightLevel(visitCount, max);
      const shape = blockShape(cell, level);
      const center = hexCenter(cell);
      const labelCell = labels?.[cell.regionCode];
      return {
        regionCode: cell.regionCode,
        name: names[cell.regionCode] ?? cell.regionCode,
        visitCount,
        level,
        ...shape,
        labelX: center.x,
        labelY: center.y - level * 7 - 8,
        // 대표 칸이 지정되지 않은 격자는 모든 칸이 곧 지역이므로 전부 라벨을 단다.
        isLabel: labelCell ? labelCell.q === cell.q && labelCell.r === cell.r : true,
      };
    });
  });

  /** 지도를 읽을 수 없을 때 쓰는 목록. 방문한 지역만 담는다. */
  readonly visitedList = computed(() => this.counts().filter((c) => c.visitCount > 0));

  onSelect(regionCode: string): void {
    this.select.emit(regionCode);
  }

  ariaLabel(block: Block): string {
    return block.visitCount > 0
      ? `${block.name} ${block.visitCount}회 방문`
      : `${block.name} 방문 기록 없음`;
  }
}
