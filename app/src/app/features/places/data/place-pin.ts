import type { NearbyCategory, PlacePin } from '../model/map';
import { PLACE_PIN_CLASSES } from '../util/map-marker-styles';

/**
 * 핀 아이콘(lucide, shared/ui/icon과 같은 모양). 지도 DOM은 데이터 층이 직접 만들어 아이콘 부품을 쓸 수 없어 경로만 둔다.
 */
const ICON: Readonly<Record<NearbyCategory | 'added', string>> = {
  meal: 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7',
  cafe: 'M10 2v2M14 2v2M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1M6 2v2',
  sight: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0M9 10a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
  stay: 'M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M12 4v6M2 18h20',
  added: 'M20 6 9 17l-5-5',
};
const LABEL: Readonly<Record<NearbyCategory, string>> = { meal: '맛집', cafe: '카페', sight: '관광', stay: '숙소' };

/** 큰 지도의 주변 장소 핀 버튼. 카카오·테스트 지도가 같은 모양을 쓴다. */
export function placePinElement(pin: PlacePin, selected: boolean, onClick: (id: string) => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `${PLACE_PIN_CLASSES} tc-pin--${pin.category}${pin.added ? ' tc-pin--added' : ''}`;
  btn.dataset['placeId'] = pin.id;
  btn.setAttribute('aria-label', `${LABEL[pin.category]} ${pin.title}${pin.added ? ' (담음)' : ''}`);
  btn.setAttribute('aria-pressed', String(selected));
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [k, v] of Object.entries({ width: '15', height: '15', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }))
    svg.setAttribute(k, v);
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', ICON[pin.added ? 'added' : pin.category]);
  svg.appendChild(path);
  btn.appendChild(svg);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick(pin.id);
  });
  return btn;
}
