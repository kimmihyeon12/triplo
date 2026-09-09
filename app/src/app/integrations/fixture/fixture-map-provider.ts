import { Injectable } from '@angular/core';
import { overlappingStayIds, type DayMapModel } from '../../domain/map-markers';
import type { MapInstance, MapMountOptions, MapProvider, MapProviderAvailability } from '../map-provider';

/**
 * Playwright 테스트 앱 전용 지도 픽스처. 타일 없이 마커를 DOM 버튼으로 그려
 * 마커 개수·순번·선택 상태·안내선 유무를 자동 테스트에서 확인한다.
 */
@Injectable({ providedIn: 'root' })
export class FixtureMapProvider implements MapProvider {
  async availability(): Promise<MapProviderAvailability> {
    return { available: true, reason: null, providerLabel: '테스트 지도' };
  }

  async mount(container: HTMLElement, _options: MapMountOptions, onMarkerClick: (id: string) => void): Promise<MapInstance> {
    // 테스트 전용 플래그: 지도 오류·느린 로딩 상태를 재현한다.
    const delay = Number(globalThis.localStorage?.getItem('tc.test.mapDelayMs') ?? 0);
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    if (globalThis.localStorage?.getItem('tc.test.mapFail')) throw new Error('테스트용 지도 로드 실패');
    container.classList.add('tc-fixture-map');
    container.setAttribute('data-testid', 'fixture-map');
    const layer = document.createElement('div');
    layer.className = 'tc-fixture-map__layer';
    container.appendChild(layer);
    let els: HTMLElement[] = [];

    return {
      render(model: DayMapModel) {
        layer.replaceChildren();
        els = [];
        const b = model.bounds;
        const offset = overlappingStayIds(model.markers);
        const placed: { x: number; y: number }[] = [];
        for (const m of model.markers) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'tc-marker ' + (m.kind === 'stay' ? 'tc-marker--stay' : 'tc-marker--stop') + (offset.has(m.id) ? ' tc-marker--offset' : '');
          btn.dataset['testid'] = 'map-marker-' + m.id;
          btn.dataset['markerId'] = m.id;
          btn.dataset['kind'] = m.kind;
          btn.textContent = m.kind === 'stay' ? '숙' : String(m.number);
          btn.setAttribute('aria-label', (m.number ? `${m.number}번 ` : '숙소 ') + m.title);
          // 경계 상자 안 상대 위치로 배치(시각 확인용, 실제 타일 아님)
          let x = b && b.east !== b.west ? ((m.position.lng - b.west) / (b.east - b.west)) * 80 + 10 : 50;
          let y = b && b.north !== b.south ? ((b.north - m.position.lat) / (b.north - b.south)) * 80 + 10 : 50;
          // 픽스처 투영에서 순번 마커와 겹치는 숙소 마커는 오른쪽 위로 비킨다(순번이 항상 읽히게).
          if (m.kind === 'stay') {
            const near = placed.some((p) => Math.abs(p.x - x) < 9 && Math.abs(p.y - y) < 9);
            if (near) {
              btn.classList.add('tc-marker--offset');
              x += 6;
              y -= 6;
            }
          } else {
            placed.push({ x, y });
          }
          btn.style.left = `${x}%`;
          btn.style.top = `${y}%`;
          btn.addEventListener('click', () => onMarkerClick(m.id));
          layer.appendChild(btn);
          els.push(btn);
        }
        const line = document.createElement('span');
        line.dataset['testid'] = 'map-guideline';
        line.dataset['points'] = String(model.guideLine.length);
        line.className = 'visually-hidden';
        line.textContent = model.guideLine.length >= 2 ? `방문 순서 안내선 ${model.guideLine.length}점` : '안내선 없음';
        layer.appendChild(line);
      },
      highlight(id: string | null) {
        for (const el of els) el.classList.toggle('tc-marker--on', el.dataset['markerId'] === id);
      },
      relayout() {},
      destroy() {
        layer.remove();
      },
    };
  }
}
