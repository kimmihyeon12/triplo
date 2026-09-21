import { expect, it } from 'vitest';
import { visibleMarkers } from './visible-markers';

it('bounds visible pins, avoids overlap and prioritizes the selected region', () => {
  const labels = Array.from({ length: 17 }, (_, i) => ({ id: String(i), name: String(i), x: i * 110, y: 80, temporary: false }));
  expect(visibleMarkers(labels, 1, null)).toHaveLength(6);
  expect(visibleMarkers(labels, 2, null)).toHaveLength(10);
  expect(visibleMarkers(labels, 1, '16')[0].id).toBe('16');
  const overlapping = labels.map(label => ({ ...label, x: 60 }));
  expect(visibleMarkers(overlapping, 1, '16').map(label => label.id)).toEqual(['16']);
  expect(visibleMarkers([...overlapping, { id: 'temporary', name: 'Region', x: 60, y: 80, temporary: true }], 1, null)[0].id).toBe('temporary');
});
