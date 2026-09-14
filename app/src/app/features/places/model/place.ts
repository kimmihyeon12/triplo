export interface GeoPoint {
  lat: number;
  lng: number;
}

/** 외부 장소 제공자 참조. 좌표와 함께 보존해 이후 상세 조회·경로 계산에 쓴다. */
export interface PlaceRef {
  provider: 'kakao' | 'fixture';
  id: string;
  url: string | null;
}

/** 장소 검색 제공자가 돌려주는 후보. 제공자별 어댑터가 이 형태로 정규화한다. */
export interface PlaceCandidate {
  provider: PlaceRef['provider'];
  id: string;
  name: string;
  /** 지번 주소 */
  address: string;
  /** 도로명 주소(없으면 빈 문자열) */
  roadAddress: string;
  lat: number;
  lng: number;
  category: string;
  url: string | null;
}

