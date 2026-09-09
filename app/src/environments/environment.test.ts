export const environment = {
  /** Playwright 테스트 앱 전용 저장 키. 런타임 데이터와 섞이지 않는다. */
  storageKey: 'tc.test.trips.v1',
  isTest: true,
  /** 테스트 앱은 외부 호출 없는 픽스처 지도·검색을 쓴다 */
  mapProvider: 'fixture' as 'kakao' | 'fixture',
};
