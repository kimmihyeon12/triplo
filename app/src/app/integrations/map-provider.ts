import { InjectionToken } from '@angular/core';
import type { DayMapModel } from '../domain/map-markers';

export interface MapMountOptions {
  /** 초기 중심(마커가 없을 때만 사용) */
  center: { lat: number; lng: number };
}

export interface MapInstance {
  /** 마커·안내선을 모델대로 교체하고 마커가 있으면 화면에 맞춘다 */
  render(model: DayMapModel): void;
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
  mount(container: HTMLElement, options: MapMountOptions, onMarkerClick: (id: string) => void): Promise<MapInstance>;
}

export const MAP_PROVIDER = new InjectionToken<MapProvider>('MAP_PROVIDER');

/** 대한민국 대략 중심(마커가 없을 때 초기 화면용). 장소 좌표로 쓰지 않는다. */
export const KOREA_CENTER = { lat: 36.5, lng: 127.8 };
