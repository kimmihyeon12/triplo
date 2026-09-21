import { describe, expect, it } from 'vitest';
import { KOREA_ORIGIN, createProjection, pointInPolygon, pointInRing } from './projection';
import { buildGrid, type GeoCollection } from './geo-grid';

describe('좌표 투영', () => {
  const project = createProjection(KOREA_ORIGIN);

  it('기준점은 원점이 된다', () => {
    const p = project({ lng: KOREA_ORIGIN.lng, lat: KOREA_ORIGIN.lat });
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });

  it('위도 1도가 경도 1도보다 길다', () => {
    // 위도 36도에서 경도 1도는 약 90km, 위도 1도는 약 111km다. 이 차이를
    // 반영하지 않으면 한국이 가로로 늘어나 보인다.
    const east = project({ lng: KOREA_ORIGIN.lng + 1, lat: KOREA_ORIGIN.lat });
    const north = project({ lng: KOREA_ORIGIN.lng, lat: KOREA_ORIGIN.lat + 1 });
    expect(Math.abs(east.x)).toBeLessThan(Math.abs(north.y));
    expect(Math.abs(east.x)).toBeCloseTo(90.1, 0);
    expect(Math.abs(north.y)).toBeCloseTo(111.3, 0);
  });

  it('북쪽으로 갈수록 y가 작아진다', () => {
    // 화면은 y가 아래로 커진다. 위도가 높은 곳이 위에 와야 한다.
    const north = project({ lng: 127.5, lat: 38 });
    const south = project({ lng: 127.5, lat: 34 });
    expect(north.y).toBeLessThan(south.y);
  });
});

describe('다각형 안쪽 판정', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it('사각형 안의 점을 찾는다', () => {
    expect(pointInRing({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInRing({ x: 15, y: 5 }, square)).toBe(false);
    expect(pointInRing({ x: 5, y: -1 }, square)).toBe(false);
  });

  it('구멍 안의 점은 바깥으로 본다', () => {
    const hole = [
      { x: 3, y: 3 },
      { x: 7, y: 3 },
      { x: 7, y: 7 },
      { x: 3, y: 7 },
    ];
    expect(pointInPolygon({ x: 1, y: 1 }, [square, hole])).toBe(true);
    expect(pointInPolygon({ x: 5, y: 5 }, [square, hole])).toBe(false);
  });

  it('고리가 없으면 항상 바깥이다', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, [])).toBe(false);
  });
});

describe('격자 만들기', () => {
  /** 경도 1도, 위도 1도짜리 네모 지역 하나. */
  const box: GeoCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { code: 'A', name: '가지역' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [127.0, 36.0],
              [128.0, 36.0],
              [128.0, 37.0],
              [127.0, 37.0],
              [127.0, 36.0],
            ],
          ],
        },
      },
    ],
  };

  const options = {
    cellSize: 10,
    origin: KOREA_ORIGIN,
    codeOf: (p: Record<string, unknown>) => String(p['code']),
    nameOf: (p: Record<string, unknown>) => String(p['name']),
  };

  it('경계 안쪽만 칸으로 만든다', () => {
    const grid = buildGrid(box, options);
    expect(grid.cells.length).toBeGreaterThan(0);
    // 모든 칸이 그 지역에 속한다.
    expect(grid.cells.every((c) => c.regionCode === 'A')).toBe(true);
  });

  it('칸 크기를 줄이면 칸이 늘어난다', () => {
    const coarse = buildGrid(box, { ...options, cellSize: 20 });
    const fine = buildGrid(box, { ...options, cellSize: 10 });
    expect(fine.cells.length).toBeGreaterThan(coarse.cells.length);
  });

  it('지역 중심을 낸다', () => {
    const grid = buildGrid(box, options);
    const center = grid.centers.get('A');
    expect(center).toBeDefined();
    // 네모의 가운데는 경도 127.5·위도 36.5 부근이다. 기준점이 127.5·36.0이므로
    // x는 0 근처, y는 위도가 0.5도 높으니 음수여야 한다.
    expect(Math.abs(center!.x)).toBeLessThan(10);
    expect(center!.y).toBeLessThan(0);
  });

  it('지역이 없으면 빈 격자를 준다', () => {
    const empty: GeoCollection = { type: 'FeatureCollection', features: [] };
    const grid = buildGrid(empty, options);
    expect(grid.cells).toEqual([]);
    expect(grid.centers.size).toBe(0);
  });

  /*
    광역시는 도 안에 둘러싸여 있고, 단순화된 경계에서는 두 폴리곤이 겹친다.
    큰 지역을 먼저 보면 작은 지역이 격자에서 통째로 사라진다. 실제로 광주가
    전남에 먹혀 지도에 나오지 않았고, 서울 좌표의 마커가 경기로 잡혔다
    (2026-09-21 확인).
  */
  const nested: GeoCollection = {
    type: 'FeatureCollection',
    features: [
      // 큰 지역이 먼저 온다. GeoJSON의 실제 순서와 같다.
      {
        type: 'Feature',
        properties: { code: 'BIG', name: '큰지역' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[127.0, 36.0], [128.0, 36.0], [128.0, 37.0], [127.0, 37.0], [127.0, 36.0]]],
        },
      },
      // 큰 지역 한가운데 들어 있는 작은 지역.
      {
        type: 'Feature',
        properties: { code: 'SMALL', name: '작은지역' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[127.4, 36.4], [127.6, 36.4], [127.6, 36.6], [127.4, 36.6], [127.4, 36.4]]],
        },
      },
    ],
  };

  it('작은 지역이 큰 지역에 먹히지 않는다', () => {
    const grid = buildGrid(nested, { ...options, cellSize: 4 });
    const codes = new Set(grid.cells.map((c) => c.regionCode));
    expect(codes.has('SMALL')).toBe(true);
    expect(codes.has('BIG')).toBe(true);
  });

  it('겹친 칸은 작은 지역으로 배정한다', () => {
    const grid = buildGrid(nested, { ...options, cellSize: 4 });
    const small = grid.centers.get('SMALL');
    expect(small).toBeDefined();
    // 작은 지역 칸은 모두 그 경계 안에 있다. 큰 지역이 가져가면 0칸이 된다.
    expect(grid.cells.filter((c) => c.regionCode === 'SMALL').length).toBeGreaterThan(0);
  });
});
