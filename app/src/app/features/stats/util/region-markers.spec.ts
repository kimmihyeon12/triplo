import { describe, expect, it } from 'vitest';
import type { GeoCollection } from '../../../shared/util/geo/geo-grid';
import { regionMarkers } from './region-markers';

describe('region markers', () => {
  it('collapses different saved coordinates in a region and omits unsupported land', () => {
    const geo: GeoCollection = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { code: '11' },
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [3, 0], [3, 3], [0, 3], [0, 0]]] } }] };
    const markers = [1, 2, 10].map(n => ({ id: String(n), name: 'Place ' + n, location: { lat: n, lng: n }, places: [] }));
    const before = structuredClone(markers);
    expect(regionMarkers(markers, geo, { '11': 'seoul' }, { seoul: '서울' })).toEqual([{ id: 'seoul', name: '서울' }]);
    expect(markers).toEqual(before);
    expect(regionMarkers([], geo, { '11': 'seoul' }, { seoul: '서울' })).toEqual([]);
  });
});
