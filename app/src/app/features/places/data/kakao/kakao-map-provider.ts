import { MAP_MARKER_CLASSES } from '../../util/map-marker-styles';
import { inject, Injectable } from '@angular/core';
import { overlappingStayIds } from '../../util/map-markers';
import { type DayMapModel, type MapBounds, type MapMarker, type PlacePin } from '../../model/map';
import { placePinElement } from '../place-pin';
import type {
  MapInstance,
  MapMountOptions,
  MapProvider,
  MapProviderAvailability,
} from '../map-provider';
import { KakaoSdkLoader } from './kakao-loader';

/** 카카오 지도 위에 순번 마커(CustomOverlay)·숙소 마커·방문 순서 안내선(Polyline)을 그린다. */
@Injectable({ providedIn: 'root' })
export class KakaoMapProvider implements MapProvider {
  private readonly loader = inject(KakaoSdkLoader);

  async availability(): Promise<MapProviderAvailability> {
    if (!this.loader.hasKey) {
      return {
        available: false,
        reason: '카카오 JavaScript 키가 설정되지 않았습니다.',
        providerLabel: '카카오맵',
      };
    }
    try {
      await this.loader.load();
      return { available: true, reason: null, providerLabel: '카카오맵' };
    } catch (e) {
      return {
        available: false,
        reason: e instanceof Error ? e.message : '지도 SDK 로드 실패',
        providerLabel: '카카오맵',
      };
    }
  }

  async mount(
    container: HTMLElement,
    options: MapMountOptions,
    onMarkerClick: (id: string) => void,
  ): Promise<MapInstance> {
    const maps = await this.loader.load();
    const map = new maps.Map(container, {
      center: new maps.LatLng(options.center.lat, options.center.lng),
      level: 12,
    });
    let overlays: {
      id: string;
      overlay: any;
      el: HTMLElement;
      position: { lat: number; lng: number };
    }[] = [];
    let line: any = null;
    let pins: any[] = [];
    const boundsOf = (): MapBounds | null => {
      const b = map.getBounds();
      if (!b) return null;
      const sw = b.getSouthWest();
      const ne = b.getNorthEast();
      return { south: sw.getLat(), west: sw.getLng(), north: ne.getLat(), east: ne.getLng() };
    };
    // 큰 지도는 이동·확대가 끝날 때마다 범위를 알린다('이 지역에서 다시 찾기').
    if (options.onIdle) {
      const onIdle = options.onIdle;
      maps.event.addListener(map, 'idle', () => {
        const b = boundsOf();
        if (b) onIdle(b);
      });
    }

    const clear = () => {
      for (const o of overlays) o.overlay.setMap(null);
      overlays = [];
      if (line) {
        line.setMap(null);
        line = null;
      }
    };

    return {
      render(model: DayMapModel, fit = true) {
        clear();
        const offset = overlappingStayIds(model.markers);
        for (const m of model.markers) {
          const el = markerElement(m, onMarkerClick, offset.has(m.id));
          const overlay = new maps.CustomOverlay({
            position: new maps.LatLng(m.position.lat, m.position.lng),
            content: el,
            yAnchor: 1.15,
            zIndex: m.kind === 'stop' ? 2 : 1,
          });
          overlay.setMap(map);
          overlays.push({ id: m.id, overlay, el, position: m.position });
        }
        if (model.guideLine.length >= 2) {
          line = new maps.Polyline({
            path: model.guideLine.map((p) => new maps.LatLng(p.lat, p.lng)),
            strokeWeight: 3,
            strokeColor: '#d24a33',
            strokeOpacity: 0.7,
            strokeStyle: 'shortdash',
          });
          line.setMap(map);
        }
        if (!fit) return;
        if (model.markers.length === 1) {
          const p = model.markers[0].position;
          map.setLevel(5);
          map.setCenter(new maps.LatLng(p.lat, p.lng));
        } else if (model.markers.length > 1) {
          const bounds = new maps.LatLngBounds();
          for (const m of model.markers)
            bounds.extend(new maps.LatLng(m.position.lat, m.position.lng));
          map.setBounds(bounds, 40, 40, 40, 40);
        }
      },
      highlight(id: string | null) {
        for (const o of overlays) {
          const selected = o.id === id;
          o.el.classList.toggle('tc-marker--on', selected);
          o.el.setAttribute('aria-pressed', String(selected));
        }
        // 고른 항목이 화면 밖에 있을 수 있으므로 그 위치로 지도를 옮긴다.
        // panTo는 부드럽게 이동하며, 배율은 사용자가 맞춰 둔 값을 건드리지 않는다.
        if (id === null) return;
        const target = overlays.find((o) => o.id === id);
        if (target) map.panTo(new maps.LatLng(target.position.lat, target.position.lng));
      },
      renderPlaces(next: readonly PlacePin[], selectedId: string | null) {
        for (const p of pins) p.setMap(null);
        pins = next.map((pin) => {
          const overlay = new maps.CustomOverlay({
            position: new maps.LatLng(pin.position.lat, pin.position.lng),
            content: placePinElement(pin, pin.id === selectedId, (id) => options.onPlaceClick?.(id)).root,
            xAnchor: 0,
            yAnchor: 0.5,
            zIndex: pin.id === selectedId ? 4 : 0,
          });
          overlay.setMap(map);
          return overlay;
        });
      },
      bounds: boundsOf,
      relayout() {
        map.relayout();
      },
      destroy() {
        clear();
        for (const p of pins) p.setMap(null);
        pins = [];
      },
    };
  }
}

function markerElement(m: MapMarker, onClick: (id: string) => void, offset = false): HTMLElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className =
    MAP_MARKER_CLASSES +
    ' ' +
    (m.kind === 'stay' ? 'tc-marker--stay' : 'tc-marker--stop') +
    (offset ? ' tc-marker--offset' : '');
  const prefix = m.number ? `${m.number}번 ` : '';
  btn.setAttribute('aria-label', prefix + (m.kind === 'stay' ? '숙소 ' : '') + m.title);
  btn.dataset['markerId'] = m.id;
  // 일정에 자리를 잡은 숙소는 번호로, 참고용(체크아웃)만 '숙'으로 표시한다.
  btn.textContent = m.number !== null ? String(m.number) : '숙';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick(m.id);
  });
  return btn;
}
