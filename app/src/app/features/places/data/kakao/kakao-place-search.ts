import { inject, Injectable } from '@angular/core';
import type { PlaceCandidate } from '../../model/place';
import type { MapBounds, NearbyCategory } from '../../model/map';
import type {
  NearbyPlace,
  NearbyPlaceSearch,
  PlaceSearchAvailability,
  PlaceSearchOptions,
  PlaceSearchProvider,
  PlaceSearchResult,
} from '../place-search';
import { KakaoSdkLoader } from './kakao-loader';

/** 큰 지도 분류 버튼 → 카카오 분류 코드(음식점·카페·관광명소·숙박). */
const KAKAO_CATEGORY: Readonly<Record<NearbyCategory, string>> = {
  meal: 'FD6',
  cafe: 'CE7',
  sight: 'AT4',
  stay: 'AD5',
};

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
export class KakaoPlaceSearch implements PlaceSearchProvider, NearbyPlaceSearch {
  private readonly loader = inject(KakaoSdkLoader);

  async availability(): Promise<PlaceSearchAvailability> {
    if (!this.loader.hasKey) {
      return {
        available: false,
        reason:
          '카카오 JavaScript 키가 설정되지 않았습니다. app/public/app-config.json을 만드세요.',
        providerLabel: '카카오',
      };
    }
    try {
      await this.loader.load();
      return { available: true, reason: null, providerLabel: '카카오' };
    } catch (e) {
      return {
        available: false,
        reason: e instanceof Error ? e.message : '지도 SDK 로드 실패',
        providerLabel: '카카오',
      };
    }
  }

  /** 지도 범위 안의 분류별 장소. 카카오는 한 쪽에 15곳까지라 두 쪽(최대 30곳)을 읽는다. */
  async nearby(category: NearbyCategory, bounds: MapBounds): Promise<NearbyPlace[]> {
    const maps = await this.loader.load();
    const places = new maps.services.Places();
    const rect = new maps.LatLngBounds(
      new maps.LatLng(bounds.south, bounds.west),
      new maps.LatLng(bounds.north, bounds.east),
    );
    const page = (n: number) =>
      new Promise<{ data: KakaoPlace[]; more: boolean }>((resolve, reject) => {
        places.categorySearch(
          KAKAO_CATEGORY[category],
          (data: KakaoPlace[], status: string, pagination: { hasNextPage?: boolean } | undefined) => {
            if (status === maps.services.Status.OK) resolve({ data, more: !!pagination?.hasNextPage });
            else if (status === maps.services.Status.ZERO_RESULT) resolve({ data: [], more: false });
            else reject(new Error('카카오 장소 검색 오류(' + status + ')'));
          },
          { bounds: rect, page: n, size: 15 },
        );
      });
    const first = await page(1);
    const second = first.more ? await page(2) : { data: [] as KakaoPlace[] };
    return [...first.data, ...second.data].map((p) => ({ ...toCandidate(p), nearby: category }));
  }

  async search(query: string, options: PlaceSearchOptions = {}): Promise<PlaceSearchResult> {
    const maps = await this.loader.load();
    const places = new maps.services.Places();
    const opts: Record<string, unknown> = { size: options.size ?? 15 };
    if (options.near) {
      opts['location'] = new maps.LatLng(options.near.lat, options.near.lng);
      // 기준 좌표만 주면 범위가 없어 멀리 있는 유명한 곳이 앞에 온다.
      if (options.radius) opts['radius'] = Math.min(20000, options.radius);
    }
    return new Promise<PlaceSearchResult>((resolve, reject) => {
      places.keywordSearch(
        query,
        (data: KakaoPlace[], status: string, pagination: { totalCount?: number } | undefined) => {
          if (status === maps.services.Status.OK) {
            resolve({
              candidates: data.map(toCandidate),
              total: pagination?.totalCount ?? data.length,
            });
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
