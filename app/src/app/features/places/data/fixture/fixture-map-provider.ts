import {
  MAP_MARKER_CLASSES,
  FIXTURE_MAP_CLASSES,
  FIXTURE_LAYER_CLASSES,
} from '../../util/map-marker-styles';
import { Injectable } from '@angular/core';
import { overlappingStayIds } from '../../util/map-markers';
import { type DayMapModel, type MapBounds, type PlacePin } from '../../model/map';
import { placePinElement } from '../place-pin';
import type {
  MapInstance,
  MapMountOptions,
  MapProvider,
  MapProviderAvailability,
} from '../map-provider';

/**
 * Playwright 테스트 앱 전용 지도 픽스처. 타일 없이 마커를 DOM 버튼으로 그려
 * 마커 개수·순번·선택 상태·안내선 유무를 자동 테스트에서 확인한다.
 */
@Injectable({ providedIn: 'root' })
export class FixtureMapProvider implements MapProvider {
  async availability(): Promise<MapProviderAvailability> {
    return { available: true, reason: null, providerLabel: '테스트 지도' };
  }

  async mount(
    container: HTMLElement,
    options: MapMountOptions,
    onMarkerClick: (id: string) => void,
  ): Promise<MapInstance> {
    // 테스트 전용 플래그: 지도 오류·느린 로딩 상태를 재현한다.
    const delay = Number(globalThis.localStorage?.getItem('tc.test.mapDelayMs') ?? 0);
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    if (globalThis.localStorage?.getItem('tc.test.mapFail'))
      throw new Error('테스트용 지도 로드 실패');
    container.classList.add(...FIXTURE_MAP_CLASSES.split(' '));
    container.setAttribute('data-testid', 'fixture-map');
    const layer = document.createElement('div');
    layer.className = FIXTURE_LAYER_CLASSES;
    container.appendChild(layer);
    let els: HTMLElement[] = [];
    const pinLayer = document.createElement('div');
    pinLayer.className = FIXTURE_LAYER_CLASSES;
    pinLayer.dataset['testid'] = 'map-places';
    container.appendChild(pinLayer);
    // 지금 '보이는' 범위. 실제 타일이 없어 마커 범위(또는 초기 중심 주변)로 정한다.
    const around = (lat: number, lng: number): MapBounds => ({ south: lat - 0.03, north: lat + 0.03, west: lng - 0.04, east: lng + 0.04 });
    let view: MapBounds = around(options.center.lat, options.center.lng);
    let lastPins: readonly PlacePin[] = [];
    let lastSelected: string | null = null;
    const drawPins = () => {
      pinLayer.replaceChildren();
      for (const pin of lastPins) {
        const { lat, lng } = pin.position;
        if (lat < view.south || lat > view.north || lng < view.west || lng > view.east) continue;
        const btn = placePinElement(pin, pin.id === lastSelected, (id) => options.onPlaceClick?.(id));
        btn.dataset['testid'] = 'map-place-' + pin.id;
        btn.style.left = `${((lng - view.west) / (view.east - view.west)) * 100}%`;
        btn.style.top = `${((view.north - lat) / (view.north - view.south)) * 100}%`;
        pinLayer.appendChild(btn);
      }
    };
    // 테스트가 지도를 '옮긴' 것처럼 범위를 바꾼다. 실제 지도의 idle 알림과 같은 흐름을 탄다.
    container.addEventListener('tc-fixture-move', (event) => {
      view = (event as CustomEvent<MapBounds>).detail;
      drawPins();
      options.onIdle?.(view);
    });

    return {
      render(model: DayMapModel, fit = true) {
        if (fit && model.bounds) {
          const b = model.bounds;
          const padLat = Math.max((b.north - b.south) / 8, 0.01);
          const padLng = Math.max((b.east - b.west) / 8, 0.01);
          view = { south: b.south - padLat, north: b.north + padLat, west: b.west - padLng, east: b.east + padLng };
          options.onIdle?.(view);
        }
        layer.replaceChildren();
        els = [];
        const b = model.bounds;
        const offset = overlappingStayIds(model.markers);
        const placed: { x: number; y: number }[] = [];
        for (const m of model.markers) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className =
            MAP_MARKER_CLASSES +
            ' ' +
            (m.kind === 'stay' ? 'tc-marker--stay' : 'tc-marker--stop') +
            (offset.has(m.id) ? ' tc-marker--offset' : '');
          btn.dataset['testid'] = 'map-marker-' + m.id;
          btn.dataset['markerId'] = m.id;
          btn.dataset['kind'] = m.kind;
          btn.textContent = m.number !== null ? String(m.number) : '숙';
          btn.setAttribute(
            'aria-label',
            (m.number ? `${m.number}번 ` : '') + (m.kind === 'stay' ? '숙소 ' : '') + m.title,
          );
          // 경계 상자 안 상대 위치로 배치(시각 확인용, 실제 타일 아님)
          let x =
            b && b.east !== b.west ? ((m.position.lng - b.west) / (b.east - b.west)) * 80 + 10 : 50;
          let y =
            b && b.north !== b.south
              ? ((b.north - m.position.lat) / (b.north - b.south)) * 80 + 10
              : 50;
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
        line.className = 'sr-only';
        line.textContent =
          model.guideLine.length >= 2
            ? `방문 순서 안내선 ${model.guideLine.length}점`
            : '안내선 없음';
        layer.appendChild(line);
      },
      highlight(id: string | null) {
        for (const el of els) {
          const selected = el.dataset['markerId'] === id;
          el.classList.toggle('tc-marker--on', selected);
          el.setAttribute('aria-pressed', String(selected));
        }
        // 실제 지도가 없어 이동 자체는 없다. 어디로 옮겼는지만 남겨 테스트가 확인하게 한다.
        layer.dataset['centeredOn'] = id ?? '';
      },
      renderPlaces(pins: readonly PlacePin[], selectedId: string | null) {
        lastPins = pins;
        lastSelected = selectedId;
        drawPins();
      },
      bounds: () => view,
      relayout() {},
      destroy() {
        layer.remove();
        pinLayer.remove();
      },
    };
  }
}
