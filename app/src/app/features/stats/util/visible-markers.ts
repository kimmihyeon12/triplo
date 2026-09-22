import type { MapLabel } from '../model/map-marker';

/**
 * 화면에 띄울 마커를 고른다.
 *
 * 자리는 모두 돌려주되 이름표가 겹치는 것만 `labelHidden`으로 표시한다.
 * 예전에는 겹치는 마커를 통째로 버려서, 광주와 나주처럼 격자에서 바로
 * 이웃한 시·군이 지도에서 사라졌다. '내가 간 곳이 지도에 없다'로 읽히므로
 * 점은 남기고 글자만 숨긴다(2026-09-22 결정). 확대하면 이름이 나타난다.
 */
export function visibleMarkers(labels: readonly MapLabel[], zoom: number, selected: string | null): MapLabel[] {
  // 이름표를 몇 개까지 띄울지. 점은 이 수와 무관하게 모두 남는다.
  const limit = zoom < 1.6 ? 6 : 10;
  // 선택한 마커와 임시 선택은 늘 우선한다. 그 다음은 많이 간 곳이다.
  const priority = (label: MapLabel) => label.id === selected ? 2 : label.temporary ? 1 : 0;
  const ordered = [...labels].sort((a, b) =>
    priority(b) - priority(a) ||
    (b.count ?? 0) - (a.count ?? 0) ||
    a.name.localeCompare(b.name, 'ko'));

  // 이름표는 대략 44×22px이다. 그보다 가까우면 글자가 포개져 읽을 수 없다.
  const gapX = zoom < 1.6 ? 46 : 38;
  const gapY = zoom < 1.6 ? 24 : 20;

  const shown: MapLabel[] = [];
  return ordered.map(label => {
    const collides = shown.length >= limit
      || shown.some(other => Math.abs(other.x - label.x) < gapX && Math.abs(other.y - label.y) < gapY);
    if (!collides) shown.push(label);
    return collides ? { ...label, labelHidden: true } : label;
  });
}
