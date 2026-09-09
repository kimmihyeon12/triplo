import { inject, Injectable } from '@angular/core';
import type { PlaceCandidate } from '../../domain/location';
import type { PlaceSearchAvailability, PlaceSearchOptions, PlaceSearchProvider, PlaceSearchResult } from '../place-search';
import { KakaoSdkLoader } from './kakao-loader';

interface KakaoPlace {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
  category_group_name?: string;
  category_name?: string;
  place_url?: string;
}

/** 카카오 지도 SDK services 라이브러리의 키워드 검색. 브라우저에서 JavaScript 키로 호출한다. */
@Injectable({ providedIn: 'root' })
export class KakaoPlaceSearch implements PlaceSearchProvider {
  private readonly loader = inject(KakaoSdkLoader);

  async availability(): Promise<PlaceSearchAvailability> {
    if (!this.loader.hasKey) {
      return { available: false, reason: '카카오 JavaScript 키가 설정되지 않았습니다. app/public/app-config.json을 만드세요.', providerLabel: '카카오' };
    }
    try {
      await this.loader.load();
      return { available: true, reason: null, providerLabel: '카카오' };
    } catch (e) {
      return { available: false, reason: e instanceof Error ? e.message : '지도 SDK 로드 실패', providerLabel: '카카오' };
    }
  }

  async search(query: string, options: PlaceSearchOptions = {}): Promise<PlaceSearchResult> {
    const maps = await this.loader.load();
    const places = new maps.services.Places();
    const opts: Record<string, unknown> = { size: options.size ?? 15 };
    if (options.near) {
      opts['location'] = new maps.LatLng(options.near.lat, options.near.lng);
    }
    return new Promise<PlaceSearchResult>((resolve, reject) => {
      places.keywordSearch(
        query,
        (data: KakaoPlace[], status: string, pagination: { totalCount?: number } | undefined) => {
          if (status === maps.services.Status.OK) {
            resolve({ candidates: data.map(toCandidate), total: pagination?.totalCount ?? data.length });
          } else if (status === maps.services.Status.ZERO_RESULT) {
            resolve({ candidates: [], total: 0 });
          } else {
            reject(new Error('카카오 장소 검색 오류(' + status + ')'));
          }
        },
        opts,
      );
    });
  }
}

function toCandidate(p: KakaoPlace): PlaceCandidate {
  return {
    provider: 'kakao',
    id: String(p.id),
    name: p.place_name,
    address: p.address_name ?? '',
    roadAddress: p.road_address_name ?? '',
    lat: Number(p.y),
    lng: Number(p.x),
    category: p.category_group_name || (p.category_name ?? '').split('>').pop()?.trim() || '',
    url: p.place_url ?? null,
  };
}
