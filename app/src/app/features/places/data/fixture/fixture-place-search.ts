import { Injectable } from '@angular/core';
import type { PlaceCandidate } from '../../model/place';
import type {
  PlaceSearchAvailability,
  PlaceSearchOptions,
  PlaceSearchProvider,
  PlaceSearchResult,
} from '../place-search';

/**
 * Playwright 테스트 앱 전용 검색 픽스처. 외부 호출 없이 고정 목록에서 이름·주소 부분 일치로 찾는다.
 * 좌표는 테스트용 근사값이며 실제 제공자 검증을 대신하지 않는다.
 */
export const FIXTURE_PLACES: PlaceCandidate[] = [
  {
    provider: 'fixture',
    id: 'f-anmok',
    name: '안목해변',
    address: '강원 강릉시 견소동',
    roadAddress: '강원 강릉시 창해로14번길 20-1',
    lat: 37.773,
    lng: 128.9475,
    category: '관광명소',
    url: null,
  },
  {
    provider: 'fixture',
    id: 'f-ojukheon',
    name: '오죽헌',
    address: '강원 강릉시 죽헌동 201',
    roadAddress: '강원 강릉시 율곡로3139번길 24',
    lat: 37.7793,
    lng: 128.878,
    category: '문화유적',
    url: null,
  },
  {
    provider: 'fixture',
    id: 'f-jungang',
    name: '속초관광수산시장',
    address: '강원 속초시 중앙동 471-1',
    roadAddress: '강원 속초시 중앙로147번길 16',
    lat: 38.205,
    lng: 128.5905,
    category: '시장',
    url: null,
  },
  {
    provider: 'fixture',
    id: 'f-hotel-a',
    name: '강릉 테스트 호텔',
    address: '강원 강릉시 강문동 274-1',
    roadAddress: '강원 강릉시 창해로 307',
    lat: 37.7919,
    lng: 128.9152,
    category: '숙박',
    url: null,
  },
  {
    provider: 'fixture',
    id: 'f-gh-b',
    name: '속초 테스트 게스트하우스',
    address: '강원 속초시 조양동 1450',
    roadAddress: '강원 속초시 엑스포로 12',
    lat: 38.1907,
    lng: 128.6014,
    category: '숙박',
    url: null,
  },
];

@Injectable({ providedIn: 'root' })
export class FixturePlaceSearch implements PlaceSearchProvider {
  /** 테스트에서 오류 상태를 재현할 때 true */
  failNext = false;

  async availability(): Promise<PlaceSearchAvailability> {
    return { available: true, reason: null, providerLabel: '테스트 픽스처' };
  }

  async search(query: string, _options: PlaceSearchOptions = {}): Promise<PlaceSearchResult> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('테스트용 검색 실패');
    }
    const q = query.trim();
    if (q === '') return { candidates: [], total: 0 };
    // 실제 검색은 '강릉 안목해변'처럼 지역이 앞에 붙어도 찾는다. 검색어 전체로 먼저
    // 맞춰 보고, 없으면 마지막 낱말(장소 이름 자리)로 다시 찾는다.
    const words = q.split(/\s+/).filter(Boolean);
    const match = (needle: string) =>
      FIXTURE_PLACES.filter(
        (p) => p.name.includes(needle) || p.address.includes(needle) || p.roadAddress.includes(needle),
      );
    const hit = match(q).length ? match(q) : match(words[words.length - 1] ?? q);
    return { candidates: hit, total: hit.length };
  }
}
