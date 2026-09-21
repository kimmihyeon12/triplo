import type { MapLabel } from '../model/map-marker';

/** Keep the active region accessible while decluttering the current viewport. */
export function visibleMarkers(labels: readonly MapLabel[], zoom: number, selected: string | null): MapLabel[] {
  const limit = zoom < 1.6 ? 6 : 10;
  const priority = (label: MapLabel) => label.id === selected ? 2 : label.temporary ? 1 : 0;
  const visible: MapLabel[] = [];
  for (const label of [...labels].sort((a, b) => priority(b) - priority(a))) {
    if (visible.length >= limit) break;
    if (!visible.some(other => Math.abs(other.x - label.x) < 100 && Math.abs(other.y - label.y) < 48)) visible.push(label);
  }
  return visible;
}
