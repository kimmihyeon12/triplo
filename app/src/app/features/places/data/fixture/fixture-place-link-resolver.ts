import { Injectable } from '@angular/core';
import { linkErrorMessage, linkedToCandidate, type LinkedCandidate, type PlaceLinkResolver } from '../place-link-resolver';

/**
 * Playwright 테스트 앱 전용 고정 응답. 외부를 부르지 않는다.
 * - test-in-kakao: 고정 검색 목록에 있는 장소(안목해변) → 카카오 쪽 후보로 담긴다
 * - test-not-in-kakao: 검색 목록에 없는 장소 → 링크의 값(네이버)으로 담긴다(2026-10-01 실제 사례)
 * - test-broken: 장소를 읽지 못한 경우
 * - place.map.kakao.com/n-…: 큰 지도 핀의 평점(회센터만 있음)
 */
@Injectable({ providedIn: 'root' })
export class FixturePlaceLinkResolver implements PlaceLinkResolver {
  async resolve(url: string): Promise<LinkedCandidate> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (url.endsWith('/test-in-kakao'))
      return linkedToCandidate({
        provider: 'naver',
        id: '1000001',
        name: '안목해변',
        roadAddress: '강원 강릉시 창해로14번길 20-1',
        address: '강원 강릉시 견소동',
        lat: 37.7731,
        lng: 128.9476,
        category: '해수욕장',
        url: 'https://m.place.naver.com/place/1000001/home',
        rating: 4.5,
        reviewCount: 120,
      });
    if (url.endsWith('/test-not-in-kakao'))
      return linkedToCandidate({
        provider: 'naver',
        id: '2058177895',
        name: '신가회전훠궈 수원역점',
        roadAddress: '경기 수원시 팔달구 향교로 25-1 2층',
        address: '경기 수원시 팔달구 매산로2가 28-2',
        lat: 37.268625,
        lng: 127.0037697,
        category: '중식당',
        url: 'https://m.place.naver.com/place/2058177895/home',
        rating: 4.7,
        reviewCount: 23,
      });
    // 큰 지도에서 핀을 누르면 그 장소의 카카오 평점을 읽는다(고정 목록의 회센터만 평점이 있다).
    if (url.includes('place.map.kakao.com/n-'))
      return linkedToCandidate({
        provider: 'kakao',
        id: url.split('/').pop()!,
        name: '',
        roadAddress: '',
        address: '',
        lat: 37.77,
        lng: 128.94,
        category: '',
        url,
        rating: url.endsWith('/n-grill') ? 4.4 : null,
        reviewCount: url.endsWith('/n-grill') ? 9 : null,
      });
    throw new Error(linkErrorMessage('place_not_found'));
  }
}
