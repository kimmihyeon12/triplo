/**
 * 스토어 이미지 캡처 전용(2026-10-06). 테스트 앱처럼 모의 인증·기기 저장·고정 AI 응답을 쓰되,
 * 지도와 장소 검색만 실제 카카오를 써서 지도 타일이 보이게 한다. e2e/store.shots.ts가 쓴다.
 */
export const environment = {
  storageKey: 'tc.test.trips.v1',
  isTest: true,
  designPreview: false,
  mapProvider: 'kakao' as 'kakao' | 'fixture',
};
