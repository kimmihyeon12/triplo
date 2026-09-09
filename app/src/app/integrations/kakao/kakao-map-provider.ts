import { inject, Injectable } from '@angular/core';
import { overlappingStayIds, type DayMapModel, type MapMarker } from '../../domain/map-markers';
import type { MapInstance, MapMountOptions, MapProvider, MapProviderAvailability } from '../map-provider';
import { KakaoSdkLoader } from './kakao-loader';

/** 카카오 지도 위에 순번 마커(CustomOverlay)·숙소 마커·방문 순서 안내선(Polyline)을 그린다. */
@Injectable({ providedIn: 'root' })
export class KakaoMapProvider implements MapProvider {
  private readonly loader = inject(KakaoSdkLoader);

  async availability(): Promise<MapProviderAvailability> {
    if (!this.loader.hasKey) {
      return { available: false, reason: '카카오 JavaScript 키가 설정되지 않았습니다.', providerLabel: '카카오맵' };
    }
    try {
      await this.loader.load();
      return { available: true, reason: null, providerLabel: '카카오맵' };
    } catch (e) {
      return { available: false, reason: e instanceof Error ? e.message : '지도 SDK 로드 실패', providerLabel: '카카오맵' };
    }
  }

  async mount(container: HTMLElement, options: MapMountOptions, onMarkerClick: (id: string) => void): Promise<MapInstance> {
    const maps = await this.loader.load();
    const map = new maps.Map(container, { center: new maps.LatLng(options.center.lat, options.center.lng), level: 12 });
    let overlays: { id: string; overlay: any; el: HTMLElement }[] = [];
    let line: any = null;

    const clear = () => {
      for (const o of overlays) o.overlay.setMap(null);
      overlays = [];
      if (line) {
        line.setMap(null);
        line = null;
      }
    };

    return {
      render(model: DayMapModel) {
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
          overlays.push({ id: m.id, overlay, el });
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
        if (model.markers.length === 1) {
          const p = model.markers[0].position;
          map.setLevel(5);
          map.setCenter(new maps.LatLng(p.lat, p.lng));
        } else if (model.markers.length > 1) {
          const bounds = new maps.LatLngBounds();
          for (const m of model.markers) bounds.extend(new maps.LatLng(m.position.lat, m.position.lng));
          map.setBounds(bounds, 40, 40, 40, 40);
        }
      },
      highlight(id: string | null) {
        for (const o of overlays) o.el.classList.toggle('tc-marker--on', o.id === id);
      },
      relayout() {
        map.relayout();
      },
      destroy() {
        clear();
      },
    };
  }
}

function markerElement(m: MapMarker, onClick: (id: string) => void, offset = false): HTMLElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tc-marker ' + (m.kind === 'stay' ? 'tc-marker--stay' : 'tc-marker--stop') + (offset ? ' tc-marker--offset' : '');
  btn.setAttribute('aria-label', (m.number ? `${m.number}번 ` : '숙소 ') + m.title);
  btn.dataset['markerId'] = m.id;
  btn.textContent = m.kind === 'stay' ? '숙' : String(m.number);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick(m.id);
  });
  return btn;
}
