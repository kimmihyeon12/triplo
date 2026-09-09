export const environment = {
  /** 런타임 앱의 기기 저장 키. 테스트 앱과 분리한다. */
  storageKey: 'tc.trips.v1',
  isTest: false,
  /** 지도·장소 검색 제공자. 런타임은 카카오(키는 public/app-config.json), 테스트는 픽스처 */
  mapProvider: 'kakao' as 'kakao' | 'fixture',
};
