import { InjectionToken } from '@angular/core';
import type { DayMapModel, MapBounds, PlacePin } from '../model/map';

export interface MapMountOptions {
  /** 초기 중심(마커가 없을 때만 사용) */
  center: { lat: number; lng: number };
  /** 주변 장소 핀을 눌렀을 때(큰 지도) */
  onPlaceClick?: (id: string) => void;
  /** 지도 이동·확대가 끝났을 때 보이는 범위(큰 지도) */
  onIdle?: (bounds: MapBounds) => void;
}

export interface MapInstance {
  /** 마커·안내선을 모델대로 교체한다. fit이면(기본) 마커가 화면에 들도록 맞춘다 */
  render(model: DayMapModel, fit?: boolean): void;
  /** 주변 장소 핀 층을 교체한다. 일정 마커와 지도 위치는 건드리지 않는다 */
  renderPlaces(pins: readonly PlacePin[], selectedId: string | null): void;
  /** 지금 보이는 범위. 지도가 아직 없으면 null */
  bounds(): MapBounds | null;
  /** 선택 마커 강조(없으면 해제) */
  highlight(id: string | null): void;
  /** 컨테이너 크기 변경 후 다시 그리기 */
  relayout(): void;
  destroy(): void;
}

export interface MapProviderAvailability {
  available: boolean;
  reason: string | null;
  providerLabel: string;
}

/** 지도 표시 제공자 어댑터. 지도 표시와 장소 검색은 별개 연동이다. */
export interface MapProvider {
  availability(): Promise<MapProviderAvailability>;
  mount(
    container: HTMLElement,
    options: MapMountOptions,
    onMarkerClick: (id: string) => void,
  ): Promise<MapInstance>;
}

export const MAP_PROVIDER = new InjectionToken<MapProvider>('MAP_PROVIDER');

/** 대한민국 대략 중심(마커가 없을 때 초기 화면용). 장소 좌표로 쓰지 않는다. */
export const KOREA_CENTER = { lat: 36.5, lng: 127.8 };
