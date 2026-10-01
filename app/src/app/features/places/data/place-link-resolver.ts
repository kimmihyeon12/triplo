import { InjectionToken } from '@angular/core';
import type { PlaceCandidate } from '../model/place';
import type { LinkedPlace } from '../model/place-link';

/**
 * 지도 링크에서 장소를 읽는 어댑터(2026-10-01). 실제는 서버 함수 resolve-place, 테스트 앱은 고정 응답이다.
 * 실패하면 화면에 그대로 보일 문장을 담은 Error를 던진다.
 */
/** 링크에서 읽은 장소. 평점·후기 수는 화면에만 보이고 저장하지 않는다. */
export type LinkedCandidate = PlaceCandidate & { rating: number | null; reviewCount: number | null };

/** 장소 한 곳의 방문자 평점(5점 만점)과 후기 수. */
export interface PlaceRating {
  rating: number;
  reviewCount: number;
}

export interface PlaceLinkResolver {
  resolve(url: string): Promise<LinkedCandidate>;
  /** 장소 주소(번호가 든 카카오·네이버 장소 주소)들의 평점을 한 번에 읽는다. 순서대로, 없으면 null. 최대 30곳 */
  ratings(urls: readonly string[]): Promise<(PlaceRating | null)[]>;
}

export const PLACE_LINK_RESOLVER = new InjectionToken<PlaceLinkResolver>('PLACE_LINK_RESOLVER');

/** 링크에서 읽은 장소를 검색 후보와 같은 모양으로 바꾼다. 좌표는 제공자의 값 그대로다. */
export function linkedToCandidate(place: LinkedPlace): LinkedCandidate {
  return {
    provider: place.provider,
    id: place.id,
    name: place.name,
    address: place.address,
    roadAddress: place.roadAddress,
    lat: place.lat,
    lng: place.lng,
    category: place.category,
    url: place.url,
    rating: place.rating ?? null,
    reviewCount: place.reviewCount ?? null,
  };
}

/** 서버 오류 코드를 화면 문장으로 바꾼다. */
export function linkErrorMessage(code: string): string {
  switch (code) {
    case 'unsupported_url':
      return '네이버·카카오 지도 링크만 담을 수 있어요.';
    case 'place_not_found':
      return '장소를 읽지 못했어요. 이름으로 검색해 주세요.';
    case 'authentication_required':
      return '로그인이 필요해요. 다시 로그인해 주세요.';
    default:
      return '잠시 후 다시 시도해 주세요.';
  }
}
