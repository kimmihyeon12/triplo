import { describe, expect, it } from 'vitest';
import type { GeoCollection } from '../../../shared/util/geo/geo-grid';
import { regionMarkers } from './region-markers';

/** 경계 파일과 같은 모양의 시험용 지역 하나. 속성 이름은 cd·nm을 쓴다. */
const geo: GeoCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { cd: '11_종로구', nm: '종로구' },
    geometry: { type: 'Polygon', coordinates: [[[0, 0], [3, 0], [3, 3], [0, 3], [0, 0]]] },
  }],
};
const names = { '11_종로구': '종로구' };

describe('regionMarkers', () => {
  it('한 지역 안의 여러 장소를 자리 하나로 모은다', () => {
    const markers = [1, 2].map(n => ({ id: String(n), name: '장소 ' + n, location: { lat: n, lng: n }, places: [] }));
    expect(regionMarkers(markers, geo, names)).toEqual([{ id: '11_종로구', name: '종로구' }]);
  });

  it('경계 밖의 장소는 넣지 않는다', () => {
    const outside = [{ id: 'x', name: '먼 곳', location: { lat: 10, lng: 10 }, places: [] }];
    expect(regionMarkers(outside, geo, names)).toEqual([]);
  });

  it('저장된 장소 좌표를 바꾸지 않는다', () => {
    const markers = [{ id: '1', name: '장소', location: { lat: 1, lng: 1 }, places: [] }];
    const before = structuredClone(markers);
    regionMarkers(markers, geo, names);
    expect(markers).toEqual(before);
  });

  it('장소가 없으면 빈 목록을 낸다', () => {
    expect(regionMarkers([], geo, names)).toEqual([]);
  });
});
