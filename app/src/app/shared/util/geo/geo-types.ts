/**
 * 지리 좌표 계산에 쓰는 타입.
 *
 * 화면 라이브러리를 모른다. 경위도를 평면으로 펴거나 경계를 격자로 바꾸는
 * 일은 계산이므로 브라우저 없이도 검증할 수 있어야 한다.
 */

/** 경위도 한 점. GeoJSON이 쓰는 순서([경도, 위도])를 그대로 따른다. */
export interface LngLat {
  readonly lng: number;
  readonly lat: number;
}

/** 평면으로 편 좌표. 단위는 km다. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * 격자 한 칸.
 *
 * col·row는 격자 안의 자리이고 x·y는 그릴 위치다. 자리만으로는 화면에
 * 놓을 수 없고, 위치만으로는 이웃을 찾을 수 없어 둘 다 둔다.
 */
export interface Cell {
  readonly col: number;
  readonly row: number;
  readonly x: number;
  readonly y: number;
  /** 이 칸이 속한 지역 코드. 경계 밖이면 null이다. */
  readonly regionCode: string | null;
}

/** 그릴 준비가 끝난 격자. */
export interface VoxelGrid {
  readonly cells: readonly Cell[];
  /** 격자 한 칸의 실제 크기(km). */
  readonly cellSize: number;
  /** 지역 코드별 중심 좌표. 라벨과 기둥이 여기에 선다. */
  readonly centers: ReadonlyMap<string, Point>;
  /** 전체가 차지하는 범위. 카메라나 화면 맞춤에 쓴다. */
  readonly bounds: { minX: number; maxX: number; minY: number; maxY: number };
}
